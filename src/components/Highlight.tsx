import { highlight } from "../lib/search";

/** 검색어에 걸린 부분을 <mark> 로 감싼다. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const parts = highlight(text, query);
  if (!parts) return <>{text}</>;
  const [before, match, after] = parts;
  return (
    <>
      {before}
      <mark>{match}</mark>
      {after}
    </>
  );
}
