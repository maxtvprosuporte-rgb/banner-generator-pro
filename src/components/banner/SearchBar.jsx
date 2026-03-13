import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

const TMDB_KEY = "ed3d0c9bfea7f601924b810c07471202";

export default function SearchBar({ onResults, onLoading }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    onLoading(true);
    
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`
    );
    const data = await res.json();
    const filtered = (data.results || []).filter(
      (item) => item.media_type === 'movie' || item.media_type === 'tv'
    );
    onResults(filtered);
    setLoading(false);
    onLoading(false);
  };

  return (
    <div className="flex gap-3 w-full max-w-2xl mx-auto">
      <Input
        placeholder="Buscar filme ou série..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 text-base focus-visible:ring-amber-500/50"
      />
      <Button
        onClick={handleSearch}
        disabled={loading}
        className="bg-amber-500 hover:bg-amber-600 text-black font-semibold h-12 px-6"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
      </Button>
    </div>
  );
}
