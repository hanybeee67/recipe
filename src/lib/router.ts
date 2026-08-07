import { useEffect, useState } from "react";
import { EMPTY_FILTERS, GROUPS, type Filters, type Group, type SortKey } from "../types";

export type Route =
  | { name: "list"; filters: Filters }
  | { name: "detail"; id: string; filters: Filters }
  | { name: "print"; ids: string[]; filters: Filters };

const SORT_KEYS: SortKey[] = ["name", "time", "ingredients"];

function parseFilters(params: URLSearchParams): Filters {
  const group = params.get("group");
  const sort = params.get("sort");
  const list = (key: string) =>
    (params.get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    q: params.get("q") ?? "",
    group: group && (GROUPS as readonly string[]).includes(group) ? (group as Group) : "전체",
    categories: list("cat"),
    maxTime: Number(params.get("max")) || 0,
    exclude: list("ex"),
    sort: sort && SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "name",
  };
}

export function serializeFilters(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.group !== "전체") params.set("group", filters.group);
  if (filters.categories.length) params.set("cat", filters.categories.join(","));
  if (filters.maxTime) params.set("max", String(filters.maxTime));
  if (filters.exclude.length) params.set("ex", filters.exclude.join(","));
  if (filters.sort !== "name") params.set("sort", filters.sort);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [path, queryString = ""] = raw.split("?");
  const params = new URLSearchParams(queryString);
  const filters = parseFilters(params);

  const detail = /^\/recipe\/([^/]+)$/.exec(path);
  if (detail) return { name: "detail", id: decodeURIComponent(detail[1]), filters };

  if (path === "/print") {
    const ids = (params.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return { name: "print", ids, filters };
  }

  return { name: "list", filters };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

export function navigate(hash: string, replace = false): void {
  const next = hash.startsWith("#") ? hash : `#${hash}`;
  if (window.location.hash === next) return;
  if (replace) {
    window.history.replaceState(null, "", next);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = next;
  }
}

export const listHref = (filters: Filters) => `#/${serializeFilters(filters)}`;

export const detailHref = (id: string, filters: Filters) =>
  `#/recipe/${encodeURIComponent(id)}${serializeFilters(filters)}`;

export function printHref(ids: string[]): string {
  const params = new URLSearchParams();
  if (ids.length) params.set("ids", ids.join(","));
  return `#/print?${params.toString()}`;
}

export const hasActiveFilters = (f: Filters): boolean =>
  f.q !== EMPTY_FILTERS.q ||
  f.group !== EMPTY_FILTERS.group ||
  f.categories.length > 0 ||
  f.maxTime > 0 ||
  f.exclude.length > 0;
