import { authComponent } from "./betterAuth/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- authComponent is typed as any due to circular inference
export const { onCreate, onUpdate, onDelete }: any = authComponent.triggersApi();
