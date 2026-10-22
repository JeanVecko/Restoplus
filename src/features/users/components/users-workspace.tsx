"use client";

import { useEffect, useState } from "react";
import styles from "./users-workspace.module.css";

type Member = {
  id: string;
  displayName: string;
  isActive: boolean;
  membership?: { role: string; isActive: boolean };
};

type FormState = {
  email: string;
  role: "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN" | "STOCK_MANAGER";
};

const EMPTY_FORM: FormState = {
  email: "",
  role: "WAITER",
};

export function UsersWorkspace() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [invitation, setInvitation] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/members", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error ?? "Impossible de charger les utilisateurs.",
        );
      }
      setMembers(data.members ?? []);
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
    setInvitation(null);
    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Invitation refusée.");
      }
      setInvitation(data.invitationToken ?? null);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur.");
    } finally {
      setSaving(false);
    }
  }

  const roleLabel: Record<string, string> = {
    OWNER: "Propriétaire",
    MANAGER: "Gérant",
    CASHIER: "Caissier",
    WAITER: "Serveur",
    KITCHEN: "Cuisine",
    STOCK_MANAGER: "Stock",
  };

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Équipe</p>
          <h1>Utilisateurs</h1>
          <p className={styles.subtitle}>
            Comptes, rôles et permissions du restaurant.
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
      {invitation && (
        <div className={styles.success} role="status">
          Invitation créée. Token à transmettre au candidat :{" "}
          <code>{invitation}</code>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <label>
          Email
          <input
            type="email"
            required
            maxLength={320}
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
          />
        </label>
        <label>
          Rôle
          <select
            value={form.role}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                role: event.target.value as FormState["role"],
              }))
            }
          >
            <option value="MANAGER">Gérant</option>
            <option value="CASHIER">Caissier</option>
            <option value="WAITER">Serveur</option>
            <option value="KITCHEN">Cuisine</option>
            <option value="STOCK_MANAGER">Stock</option>
          </select>
        </label>
        <div className={styles.formActions}>
          <button type="submit" disabled={saving}>
            Inviter
          </button>
        </div>
      </form>

      {!loaded ? (
        <div className={styles.state}>Chargement des utilisateurs…</div>
      ) : members.length === 0 ? (
        <div className={styles.state}>
          Aucun utilisateur enregistré. Invitez votre première équipe ci-dessus.
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Rôle</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.displayName}</td>
                <td>
                  {member.membership
                    ? roleLabel[member.membership.role] ?? member.membership.role
                    : "—"}
                </td>
                <td>
                  <span
                    className={
                      member.isActive ? styles.active : styles.inactive
                    }
                  >
                    {member.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
