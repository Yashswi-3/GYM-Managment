/**
 * The single place that turns a database error into something a member may
 * see. `error.message` from Supabase is Postgres' own text — it names
 * constraints, columns and tables ("duplicate key value violates unique
 * constraint \"members_mobile_key\""), which is both meaningless to a member
 * standing at the gym door and more about the schema than a public page
 * should say. Four call sites were passing it straight through to the screen.
 *
 * The real error still goes to the server log, where it is actually useful.
 */
export function publicDbError(context: string, error: { message: string }): string {
  console.error(`[${context}]`, error.message);
  return "Something went wrong on our side. Please try again, or ask at the desk.";
}
