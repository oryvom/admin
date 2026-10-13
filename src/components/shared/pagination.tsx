import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageSize,
  total,
  query,
}: {
  page: number;
  pageSize: number;
  total: number;
  query: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const previous = page > 1 ? pageHref(page - 1, query) : null;
  const next = page < pages ? pageHref(page + 1, query) : null;

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>
        {total === 0 ? "No records" : `Page ${page} of ${pages}`}
      </p>
      <div className="flex gap-2">
        {previous ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={previous}>Previous</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        {next ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={next}>Next</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const search = params.toString();
  return search ? `/users?${search}` : "/users";
}
