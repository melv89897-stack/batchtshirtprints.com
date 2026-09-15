/**
 * Every money/NDA/listing-management action requires 2FA server-side
 * (withGuard({ requireTwoFactor: true }, ...)). When the signed-in user
 * hasn't enabled it yet, the API answers 403 { error, code: "TWO_FACTOR_REQUIRED" }.
 * Both BidPanel and NdaGate need to surface that the same way, so it lives here.
 */
export type ActionError = {
  message: string;
  twoFactorRequired?: boolean;
};

export async function readActionError(res: Response): Promise<ActionError> {
  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  const message = typeof json.error === "string" ? json.error : "Something went wrong.";
  return {
    message,
    twoFactorRequired: json.code === "TWO_FACTOR_REQUIRED",
  };
}
