export type OverviewLoadState<T> =
  | { status: "loading"; data: null }
  | { status: "success"; data: T }
  | { status: "error"; data: null };

export interface OverviewLoadRequest<T> {
  request: () => Promise<T>;
  setState: (state: OverviewLoadState<T>) => void;
  inFlight: { current: boolean };
  onFailure: (error: unknown) => void;
}

/** Runs one overview request at a time and always resolves to a terminal state. */
export async function runOverviewLoad<T>({
  request,
  setState,
  inFlight,
  onFailure,
}: OverviewLoadRequest<T>): Promise<"success" | "error" | "in-flight"> {
  if (inFlight.current) return "in-flight";

  inFlight.current = true;
  setState({ status: "loading", data: null });

  try {
    const data = await request();
    setState({ status: "success", data });
    return "success";
  } catch (error) {
    onFailure(error);
    setState({ status: "error", data: null });
    return "error";
  } finally {
    inFlight.current = false;
  }
}
