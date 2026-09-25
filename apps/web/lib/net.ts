/** What a change did, counted both ways: "Closed 3, opened 1." */
export function netChange(closed: number, opened: number): string {
  return opened > 0 ? `Closed ${closed}, opened ${opened}.` : `Closed ${closed}.`
}
