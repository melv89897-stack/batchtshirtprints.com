"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function WatchButton({ listingId, initiallyWatching }: { listingId: string; initiallyWatching: boolean }) {
  const [watching, setWatching] = useState(initiallyWatching);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      if (res.ok) {
        const json = await res.json();
        setWatching(Boolean(json.watching));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button kind="ghost" icon={watching ? BookmarkCheck : Bookmark} disabled={loading} onClick={toggle}>
      {watching ? "Watching" : "Watch"}
    </Button>
  );
}
