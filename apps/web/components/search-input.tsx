"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import type { FunctionReference } from "convex/server"
import { api } from "@openschedule/convex/api"
import { Input } from "@openschedule/ui/components/input"

const convexApi = api as unknown as {
  queries: {
    directory: {
      searchDirectory: FunctionReference<"query">
    }
  }
}

interface SearchResult {
  _id: string
  name: string
  slug: string
  address?: string
  org: {
    _id: string
    name: string
    slug: string
  }
}

export function SearchInput() {
  const router = useRouter()
  const [inputValue, setInputValue] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const results: SearchResult[] | undefined = useQuery(
    convexApi.queries.directory.searchDirectory,
    debouncedQuery ? { query: debouncedQuery } : "skip",
  )

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(result: SearchResult) {
    setIsOpen(false)
    setInputValue("")
    router.push(`/${result.org.slug}/${result.slug}`)
  }

  const showDropdown = isOpen && debouncedQuery.length > 0

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <Input
          type="text"
          placeholder="Search businesses..."
          className="pl-10"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          aria-label="Search businesses"
          aria-expanded={showDropdown}
          aria-controls="search-results"
          role="combobox"
          aria-autocomplete="list"
        />
      </div>

      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
        >
          {results === undefined && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          {results !== undefined && results.length === 0 && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No businesses found
            </div>
          )}
          {results !== undefined && results.length > 0 && (
            <ul className="max-h-60 overflow-auto py-1">
              {results.map((result) => (
                <li key={result._id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-accent"
                    onClick={() => handleSelect(result)}
                    role="option"
                    aria-selected={false}
                  >
                    <p className="text-sm font-medium">{result.org.name}</p>
                    {result.name !== result.org.name && (
                      <p className="text-xs text-foreground">{result.name}</p>
                    )}
                    {result.address && (
                      <p className="truncate text-xs text-muted-foreground">
                        {result.address}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
