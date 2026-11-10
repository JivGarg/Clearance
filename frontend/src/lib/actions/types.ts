/** Result of a form server action, read by useActionState. `at` makes each result distinct. */
export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  at?: number;
  /** Where the client should go next (e.g. the new submission's page). */
  redirectTo?: string;
}

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
