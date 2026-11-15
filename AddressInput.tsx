"use client";
// Autocomplétion d'adresses en France (Base Adresse Nationale via la Géoplateforme IGN).
// Gratuit, sans clé d'API. Endpoint : https://data.geopf.fr/geocodage/search
// À tester dans ton projet : si une requête très courte renvoie une erreur 504,
// passe sur https://data.geopf.fr/geocodage/completion/ (service dédié à la saisie).

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

export type Address = {
  label: string; // "12 Rue des Carmes 76000 Rouen"
  housenumber?: string;
  street?: string;
  postcode: string;
  city: string;
  citycode: string; // code INSEE
  lat: number;
  lon: number;
};

type Props = {
  value: Address | null;
  onChange: (a: Address | null) => void;
  placeholder?: string;
};

const API = "https://data.geopf.fr/geocodage/search";

export default function AddressInput({ value, onChange, placeholder = "Numéro et rue, ville…" }: Props) {
  const [q, setQ] = useState(value?.label ?? "");
  const [results, setResults] = useState<Address[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    // Rien à chercher si une adresse est déjà choisie ou si la saisie est trop courte
    if (value || q.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      try {
        const url = `${API}?q=${encodeURIComponent(q)}&limit=5&index=address`;
        const res = await fetch(url, { signal: ctrl.current.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        setResults(
          (json.features ?? []).map((f: any) => ({
            label: f.properties.label,
            housenumber: f.properties.housenumber,
            street: f.properties.street ?? f.properties.name,
            postcode: f.properties.postcode,
            city: f.properties.city,
            citycode: f.properties.citycode,
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }))
        );
        setError(false);
        setOpen(true);
      } catch (e: any) {
        if (e.name !== "AbortError") setError(true);
      }
    }, 300); // on attend 300 ms après la dernière frappe
    return () => clearTimeout(t);
  }, [q, value]);

  function pick(a: Address) {
    onChange(a);
    setQ(a.label);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border-2 border-[#dbe8e8] bg-white px-3 focus-within:border-[#167C78]">
        <MapPin className="h-5 w-5 text-[#167C78]" />
        <input
          className="w-full bg-transparent py-3 outline-none"
          value={q}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            if (value) onChange(null); // si on retape, on annule l'adresse validée
          }}
          onFocus={() => results.length && setOpen(true)}
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[#dbe8e8] bg-white shadow-lg">
          {results.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                onClick={() => pick(a)}
                className="block w-full px-4 py-3 text-left hover:bg-[#E3F4F0]"
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-1 text-sm text-[#b24a35]">
          Impossible de charger les adresses. Tu peux réessayer dans un instant.
        </p>
      )}
      {value && <p className="mt-1 text-sm text-[#167C78]">✅ Adresse vérifiée</p>}
    </div>
  );
}

/*
Dans Supabase, colonne(s) à ajouter à la table des annonces :
  address_label text, postcode text, city text, citycode text,
  lat double precision, lon double precision

Vie privée : affiche publiquement seulement la ville / le quartier (ou des coordonnées
arrondies), et réserve l'adresse exacte à la personne contactée.
*/
