import { describe, expect, it } from "vitest";
import { searchPages, type SearchablePage } from "@/lib/search/page-search";

const pages: SearchablePage[] = [
  { href: "/dashboard", title: "Dashboard", terms: ["dashboard", "home"] },
  { href: "/users", title: "Users", terms: ["users", "user", "accounts"] },
  { href: "/company-data/administration", title: "Administration", terms: ["administration", "admin", "company"] },
  { href: "/company-data/offices", title: "Offices", terms: ["offices", "office"] },
  { href: "/account/security", title: "Security", terms: ["security"] },
];

describe("page search", () => {
  it("waits for three letters", () => {
    expect(searchPages("of", pages)).toEqual([]);
    expect(searchPages("   ad", pages)).toEqual([]);
  });

  it("matches a partial title and a misspelling", () => {
    expect(searchPages("off", pages).map((page) => page.title)).toEqual(["Offices"]);
    expect(searchPages("ofice", pages).map((page) => page.title)).toEqual(["Offices"]);
    expect(searchPages("dashbord", pages).map((page) => page.title)).toEqual(["Dashboard"]);
    expect(searchPages("secuirty", pages).map((page) => page.title)).toEqual(["Security"]);
    expect(searchPages("adminn", pages).map((page) => page.title)).toContain("Administration");
  });

  it("does not suggest an unrelated title", () => {
    expect(searchPages("zzzz", pages)).toEqual([]);
  });
});
