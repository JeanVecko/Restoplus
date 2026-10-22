"use client";

import { useState } from "react";
import type { AuthenticatedActor } from "@/server/auth/session";
import styles from "./settings-workspace.module.css";

export function SettingsWorkspace({ actor }: { actor: AuthenticatedActor }) {
  const [name, setName] = useState(actor.restaurantName);
  const [code, setCode] = useState(actor.restaurantCode);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/restaurant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Mise a jour refusee.");
      }
      setMessage("Parametres enregistres.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Configuration</p>
          <h1>Parametres</h1>
          <p className={styles.subtitle}>
            Informations du restaurant et preferences de l&apos;espace.
          </p>
        </div>
      </header>

      {message && <div className={styles.success} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <label>
          Nom du restaurant
          <input
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Code public
          <input value={code} disabled />
        </label>
        <label>
          Proprietaire
          <input value={actor.displayName} disabled />
        </label>
        <label>
          Role
          <input value={actor.role} disabled />
        </label>
        <div className={styles.formActions}>
          <button type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>

      <section className={styles.info}>
        <h2>Politique financiere</h2>
        <p>
          L&apos;encaissement persistant reste desactive jusqu&apos;a la validation des
          regles de total, de monnaie et de recu (FINANCIAL_POLICY_PENDING).
        </p>
      </section>
    </div>
  );
}