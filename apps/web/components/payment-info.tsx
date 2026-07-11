"use client"

import { QRCodeSVG } from "qrcode.react"
import { generatePayNowQRString } from "@opencal/lib/paynow-qr"
import { Card } from "@opencal/ui/components/card"

interface PaymentInfoProps {
  type: "bank_account" | "qr_code"
  label: string
  details: {
    holderName?: string
    bankName?: string
    accountNumber?: string
    reference?: string
    method?: string
    identifierType?: string
    identifierValue?: string
    notes?: string
  } | null
  imageUrl: string | null
}

export function PaymentInfo({ type, label, details }: PaymentInfoProps) {
  if (!details) return null

  const qrString =
    type === "qr_code" && details.method === "paynow" && details.identifierValue
      ? generatePayNowQRString({
          proxyType: (details.identifierType as "phone" | "uen") ?? "phone",
          proxyValue: details.identifierValue,
          editable: true,
        })
      : null

  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-medium">Payment Instructions</h3>

      {type === "bank_account" && (
        <div className="space-y-2 text-sm">
          {details.bankName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank</span>
              <span>{details.bankName}</span>
            </div>
          )}
          {details.holderName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Holder</span>
              <span>{details.holderName}</span>
            </div>
          )}
          {details.accountNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Number</span>
              <span className="font-mono">{details.accountNumber}</span>
            </div>
          )}
          {details.reference && (
            <div className="pt-2 text-xs text-muted-foreground">
              {details.reference}
            </div>
          )}
        </div>
      )}

      {type === "qr_code" && (
        <div className="space-y-3 text-sm">
          {qrString && (
            <div className="flex justify-center">
              <QRCodeSVG value={qrString} size={192} level="M" />
            </div>
          )}
          {details.method && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span className="capitalize">{details.method}</span>
            </div>
          )}
          {details.identifierType && details.identifierValue && (
            <div className="flex justify-between">
              <span className="text-muted-foreground capitalize">{details.identifierType}</span>
              <span className="font-mono">{details.identifierValue}</span>
            </div>
          )}
          {details.notes && (
            <div className="pt-2 text-xs text-muted-foreground">
              {details.notes}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
