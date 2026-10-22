"use client";

import { useEffect, useState } from "react";
import styles from "./stocks-workspace.module.css";

type StockItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  threshold: number;
  currency: "CDF" | "USD";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  unit: string;
  quantity: string;
  threshold: string;
  currency: "CDF" | "USD";
};

const EMPTY_FORM: FormState = {
  name: "",
  unit: "unité",
  quantity: "0",
  threshold: "0",
  currency: "CDF",
};

export function StocksWorkspace() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/stocks", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error ?? "Impossible de charger le stock depuis le serveur.",
        );
      }
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    (async () => { await load(); })();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/stocks/${editingId}` : "/api/stocks";
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity) || 0,
          threshold: Number(form.threshold) || 0,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Enregistrement refusé.");
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/stocks/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Désactivation refusée.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur.");
    }
  }

  function startEdit(item: StockItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      unit: item.unit,
      quantity: String(item.quantity),
      threshold: String(item.threshold),
      currency: item.currency,
    });
  }

  function stockStatus(item: StockItem) {
    if (item.quantity <= 0) return { label: "Rupture", tone: "bg-rose-100 text-rose-700" };
    if (item.threshold > 0 && item.quantity <= item.threshold) {
      return { label: "Sous le seuil", tone: "bg-amber-100 text-amber-800" };
    }
    return { label: "OK", tone: "bg-emerald-100 text-emerald-800" };
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Inventaire</p>
          <h1>Stocks</h1>
          <p className={styles.subtitle}>
            Articles, quantités, seuils d’alerte et unités de mesure.
          </p>
        </div>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => load()}
          disabled={saving}
        >
          Actualiser
        </button>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <label>
          Nom de l&apos;article
          <input
            required
            maxLength={160}
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
        </label>
        <label>
          Unité
          <input
            required
            maxLength={30}
            value={form.unit}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, unit: event.target.value }))
            }
          />
        </label>
        <label>
          Quantité
          <input
            type="number"
            min={0}
            step="any"
            value={form.quantity}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, quantity: event.target.value }))
            }
          />
        </label>
        <label>
          Seuil d&apos;alerte
          <input
            type="number"
            min={0}
            step="any"
            value={form.threshold}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, threshold: event.target.value }))
            }
          />
        </label>
        <label>
          Devise
          <select
            value={form.currency}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                currency: event.target.value as FormState["currency"],
              }))
            }
          >
            <option value="CDF">CDF</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <div className={styles.formActions}>
          <button type="submit" disabled={saving}>
            {editingId ? "Enregistrer" : "Ajouter l&apos;article"}
          </button>
          {editingId && (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      {!loaded ? (
        <div className={styles.state}>Chargement du stock…</div>
      ) : items.length === 0 ? (
        <div className={styles.state}>
          Aucun article de stock enregistré. Commencez par en créer un ci-dessus.
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Article</th>
              <th>Unité</th>
              <th>Quantité</th>
              <th>Seuil</th>
              <th>Devise</th>
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const status = stockStatus(item);
              return (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.unit}</td>
                  <td>{item.quantity}</td>
                  <td>{item.threshold}</td>
                  <td>{item.currency}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td>
                    {item.isActive ? (
                      <>
                        <button
                          type="button"
                          className={styles.link}
                          onClick={() => startEdit(item)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className={styles.link}
                          onClick={() => handleDeactivate(item.id)}
                        >
                          Désactiver
                        </button>
                      </>
                    ) : (
                      <span className={styles.muted}>Désactivé</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
