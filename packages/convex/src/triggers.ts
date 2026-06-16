import { authComponent } from "./betterAuth/auth";

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();
