"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./demo-app.module.css";

type Row = { id: string; [key: string]: string | number | boolean };
const sections = [
  ["/", "Accueil", "⌂"], ["/menus", "Menus", "▤"], ["/tables", "Tables", "▦"],
  ["/commandes", "Commandes", "≡"], ["/cuisine", "Cuisine / Bar", "♨"],
  ["/caisse", "Caisse", "$"], ["/stocks", "Stocks", "▣"],
  ["/rapports", "Rapports", "▥"], ["/utilisateurs", "Équipe", "♙"],
  ["/parametres", "Paramètres", "⚙"], ["/admin", "Plateforme", "✦"],
] as const;

const seeds: Record<string, Row[]> = {
  menus: [
    { id: "m1", Article: "Poulet braisé", Catégorie: "Plats", Prix: "25 000 FC", Disponible: true },
    { id: "m2", Article: "Poisson grillé", Catégorie: "Plats", Prix: "32 000 FC", Disponible: true },
    { id: "m3", Article: "Frites maison", Catégorie: "Accompagnements", Prix: "8 000 FC", Disponible: true },
    { id: "m4", Article: "Jus de gingembre", Catégorie: "Boissons", Prix: "$ 3", Disponible: true },
  ],
  tables: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `t${n}`, Table: `Table ${String(n).padStart(2, "0")}`, Zone: n === 6 ? "Terrasse" : "Standard", Places: 4, État: n === 3 ? "Occupée" : "Libre" })),
  commandes: [
    { id: "o1", Numéro: "CMD-0248", Table: "Table 03", Articles: "Poulet braisé, Jus naturel", Statut: "En attente caisse" },
    { id: "o2", Numéro: "CMD-0247", Table: "Table 05", Articles: "Poisson grillé, Frites", Statut: "En préparation" },
  ],
  stocks: [
    { id: "s1", Article: "Poulet", Unité: "kg", Quantité: 12, Seuil: 5, État: "OK" },
    { id: "s2", Article: "Huile végétale", Unité: "L", Quantité: 2, Seuil: 5, État: "À réapprovisionner" },
    { id: "s3", Article: "Charbon", Unité: "sac", Quantité: 0, Seuil: 3, État: "Rupture" },
  ],
  utilisateurs: [
    { id: "u1", Nom: "Jean Vecko", "E-mail": "jeanvecko.s@gmail.com", Rôle: "Propriétaire", Statut: "Actif" },
    { id: "u2", Nom: "Serveur démo", "E-mail": "serveur@demo.local", Rôle: "Serveur", Statut: "Actif" },
  ],
  admin: [
    { id: "r1", Restaurant: "Chez Mama", Code: "chez-mama-demo", Utilisateurs: 8, Commandes: 248, Statut: "Actif" },
    { id: "r2", Restaurant: "Le Jardin", Code: "jardin-demo", Utilisateurs: 4, Commandes: 126, Statut: "Actif" },
  ],
};

const config: Record<string, { title: string; singular: string; columns: string[] }> = {
  menus: { title: "Carte & menus", singular: "Article", columns: ["Article", "Catégorie", "Prix", "Disponible"] },
  tables: { title: "Gestion des tables", singular: "Table", columns: ["Table", "Zone", "Places", "État"] },
  commandes: { title: "Commandes", singular: "Commande", columns: ["Numéro", "Table", "Articles", "Statut"] },
  cuisine: { title: "Cuisine / Bar", singular: "Commande", columns: ["Numéro", "Table", "Articles", "Statut"] },
  caisse: { title: "Caisse", singular: "Commande", columns: ["Numéro", "Table", "Articles", "Statut"] },
  stocks: { title: "Gestion des stocks", singular: "Article", columns: ["Article", "Unité", "Quantité", "Seuil", "État"] },
  utilisateurs: { title: "Équipe et utilisateurs", singular: "Membre", columns: ["Nom", "E-mail", "Rôle", "Statut"] },
  admin: { title: "Administration plateforme", singular: "Restaurant", columns: ["Restaurant", "Code", "Utilisateurs", "Commandes", "Statut"] },
};

function storageKey(key: string) { return `restoplus.demo.${key}`; }

export function DemoApp({ page }: { page: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const key = page === "cuisine" || page === "caisse" ? "commandes" : page;
  const dataConfig = config[page] ?? config.commandes;
  const title = page === "" || page === "dashboard" ? "Vue d’ensemble" : dataConfig.title;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(storageKey(key));
        setRows(saved ? JSON.parse(saved) as Row[] : (seeds[key] ?? []));
      } catch { setRows(seeds[key] ?? []); }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key]);

  function update(next: Row[]) {
    setRows(next);
    localStorage.setItem(storageKey(key), JSON.stringify(next));
  }

  const filtered = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())), [rows, query]);

  if (page === "login" || page === "admin-login") return <DemoLogin admin={page === "admin-login"} />;

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}><span className={styles.logo}>R+</span><span><b>Resto+</b><small>Restaurant démo</small></span></Link>
      <p className={styles.navLabel}>ESPACE DE TRAVAIL</p>
      <nav>{sections.map(([href, label, icon]) => <Link key={href} href={href} className={`${styles.navLink} ${(href === `/${page}` || (!page && href === "/")) ? styles.active : ""}`}><span>{icon}</span>{label}</Link>)}</nav>
      <div className={styles.profile}><span className={styles.avatar}>JV</span><span><b>Jean Vecko</b><small>Super administrateur</small></span></div>
    </aside>
    <main className={styles.main}>
      <header className={styles.topbar}><div><p className={styles.eyebrow}>ESPACE DE DÉMONSTRATION</p><h1>{title}</h1></div><div className={styles.topActions}><span className={styles.status}><i /> Mode frontend</span><Link href="/login" className={styles.logout}>Quitter la démo</Link></div></header>
      <div className={styles.banner}><span>✦</span><div><b>Prototype frontend</b><p>Vos changements sont enregistrés dans ce navigateur uniquement. Aucune donnée n’est envoyée à un serveur.</p></div><button onClick={() => { Object.keys(seeds).forEach((k) => localStorage.removeItem(storageKey(k))); location.reload(); }}>Réinitialiser la démo</button></div>
      {page === "" || page === "dashboard" ? <Dashboard /> : page === "rapports" ? <Reports /> : page === "parametres" ? <Settings /> : <section className={styles.panel}>
        <div className={styles.panelTop}><div><h2>{dataConfig.title}</h2><p>{filtered.length} élément{filtered.length > 1 ? "s" : ""} dans les données de démonstration</p></div><div className={styles.controls}><input aria-label="Rechercher" placeholder="Rechercher…" value={query} onChange={(event) => setQuery(event.target.value)} />{page !== "cuisine" && <button className={styles.primary} onClick={() => {
          const id = `${key}-${Date.now()}`;
          const newRow: Row = page === "menus" ? { id, Article: "Nouvel article", Catégorie: "Plats", Prix: "10 000 FC", Disponible: true } : page === "tables" ? { id, Table: `Table ${rows.length + 1}`, Zone: "Standard", Places: 4, État: "Libre" } : page === "stocks" ? { id, Article: "Nouvel article", Unité: "unité", Quantité: 0, Seuil: 0, État: "À vérifier" } : page === "utilisateurs" ? { id, Nom: "Nouveau membre", "E-mail": "nouveau@demo.local", Rôle: "Serveur", Statut: "Invitation démo" } : page === "admin" ? { id, Restaurant: "Nouveau restaurant", Code: "nouveau-demo", Utilisateurs: 0, Commandes: 0, Statut: "Actif" } : { id, Numéro: `CMD-${rows.length + 1}`, Table: "À emporter", Articles: "Nouvelle commande démo", Statut: "En attente caisse" };
          update([newRow, ...rows]); setNotice(`${dataConfig.singular} ajouté à la démonstration.`); setTimeout(() => setNotice(""), 2500);
        }}>＋ Ajouter {dataConfig.singular.toLowerCase()}</button>}</div></div>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {!ready ? <p className={styles.empty}>Chargement…</p> : <div className={styles.tableWrap}><table><thead><tr>{dataConfig.columns.map((column) => <th key={column}>{column}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}>{dataConfig.columns.map((column) => <td key={column}>{typeof row[column] === "boolean" ? (row[column] ? "Oui" : "Non") : String(row[column] ?? "—")}</td>)}<td><button className={styles.textAction} onClick={() => {
          const statusKey = dataConfig.columns.includes("Statut") ? "Statut" : dataConfig.columns.includes("État") ? "État" : dataConfig.columns.includes("Disponible") ? "Disponible" : "";
          if (!statusKey) return update(rows.filter((item) => item.id !== row.id));
          const current = row[statusKey]; const value = statusKey === "Disponible" ? !current : current === "Actif" || current === "Libre" ? "Désactivé" : current === "Libre" ? "Occupée" : "Actif";
          update(rows.map((item) => item.id === row.id ? { ...item, [statusKey]: value } : item));
        }}>{page === "admin" ? "Activer / désactiver" : "Modifier"}</button><button className={styles.textAction} onClick={() => update(rows.filter((item) => item.id !== row.id))}>Supprimer</button></td></tr>)}</tbody></table>{filtered.length === 0 && <p className={styles.empty}>Aucun résultat. Ajoutez un élément pour commencer.</p>}</div>}
      </section>}
      <footer className={styles.footer}>Resto+ · Prototype interactif · Données locales de démonstration</footer>
    </main>
  </div>;
}

function DemoLogin({ admin }: { admin: boolean }) {
  return <main className={styles.loginPage}><form className={styles.loginCard} onSubmit={(event) => { event.preventDefault(); location.href = admin ? "/admin" : "/"; }}><Link href="/" className={styles.loginBrand}>Resto<span>+</span></Link><p className={styles.eyebrow}>{admin ? "PLATEFORME" : "ESPACE RESTAURANT"}</p><h1>{admin ? "Administration" : "Bienvenue"}</h1><p className={styles.loginIntro}>Accédez à la démonstration frontend de votre application.</p>{!admin && <label>Restaurant<select defaultValue="Chez Mama"><option>Chez Mama</option><option>Le Jardin</option></select></label>}<label>Adresse e-mail<input type="email" defaultValue={admin ? "jeanvecko.s@gmail.com" : "jeanvecko.s@gmail.com"} required /></label><label>Mot de passe<input type="password" defaultValue="demo" required /></label><button className={styles.loginButton}>Ouvrir la démonstration</button><p className={styles.loginHint}>Pas de connexion serveur requise : ces champs illustrent uniquement l’écran de connexion.</p><Link href={admin ? "/login" : "/admin/login"} className={styles.loginSwitch}>{admin ? "Accès restaurant" : "Accès administration plateforme"} →</Link></form></main>;
}

function Dashboard() {
  const cards = [["Ventes du jour", "438 500 FC", "+12,8 %"], ["Commandes", "24", "8 en cours"], ["Tables occupées", "6 / 12", "50 %"], ["Articles actifs", "38", "4 catégories"]];
  return <><section className={styles.metrics}>{cards.map(([label, value, detail]) => <article className={styles.metric} key={label}><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>)}</section><div className={styles.dashboardGrid}><section className={styles.panel}><div className={styles.panelTop}><div><h2>Activité récente</h2><p>Suivi des commandes de démonstration</p></div><Link href="/commandes" className={styles.textAction}>Toutes les commandes →</Link></div><div className={styles.activity}><span className={styles.orderIcon}>01</span><div><b>CMD-0248 · Table 03</b><small>Poulet braisé, Jus naturel · il y a 4 min</small></div><span className={styles.tag}>En attente caisse</span></div><div className={styles.activity}><span className={styles.orderIcon}>02</span><div><b>CMD-0247 · Table 05</b><small>Poisson grillé, Frites · il y a 12 min</small></div><span className={styles.tagGreen}>En préparation</span></div><div className={styles.activity}><span className={styles.orderIcon}>03</span><div><b>CMD-0246 · À emporter</b><small>Jus de gingembre · il y a 21 min</small></div><span className={styles.tagBlue}>Prête</span></div></section><section className={styles.panel}><div className={styles.panelTop}><div><h2>Accès rapide</h2><p>Les outils principaux</p></div></div><div className={styles.quickLinks}>{sections.slice(1, 7).map(([href, label, icon]) => <Link href={href} key={href}><span>{icon}</span>{label}<b>→</b></Link>)}</div></section></div></>;
}

function Reports() { return <><section className={styles.metrics}>{[["Ventes totales", "2 845 000 FC", "Cette semaine"], ["Commandes terminées", "146", "+8,4 %"], ["Panier moyen", "19 486 FC", "Par commande"], ["Meilleur article", "Poulet braisé", "42 commandes"]].map(([a,b,c]) => <article className={styles.metric} key={a}><p>{a}</p><strong>{b}</strong><small>{c}</small></article>)}</section><section className={styles.panel}><h2>Résumé de l’activité</h2><p className={styles.subtext}>Ces indicateurs sont des exemples pour la prévisualisation du frontend.</p><div className={styles.barChart}>{[48,75,60,88,54,100,69].map((height,index)=><div key={index}><span style={{height:`${height}%`}}/><small>{["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"][index]}</small></div>)}</div></section></>; }

function Settings() { const [name,setName]=useState("Chez Mama"); const [saved,setSaved]=useState(false); return <section className={styles.panel}><h2>Informations du restaurant</h2><p className={styles.subtext}>Personnalisez l’espace de démonstration.</p><form className={styles.settingsForm} onSubmit={e=>{e.preventDefault();localStorage.setItem(storageKey("restaurant-name"),name);setSaved(true);}}><label>Nom du restaurant<input value={name} onChange={e=>setName(e.target.value)} /></label><label>Adresse e-mail<input defaultValue="jeanvecko.s@gmail.com" type="email" /></label><label>Devise principale<select defaultValue="CDF"><option>CDF</option><option>USD</option></select></label><button className={styles.primary}>Enregistrer les préférences</button>{saved&&<span className={styles.notice}>Préférences enregistrées sur cet appareil.</span>}</form><p className={styles.localNote}>Les informations restent dans le stockage local du navigateur.</p></section>; }
