/** Fake timers açıkken, bir promise'i gecikmeleriyle birlikte çözer. */
export async function settle<T>(promise: Promise<T>): Promise<T> {
  const outcome = promise.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );
  await jest.advanceTimersByTimeAsync(2000);
  const result = await outcome;
  if (!result.ok) throw result.error;
  return result.value;
}