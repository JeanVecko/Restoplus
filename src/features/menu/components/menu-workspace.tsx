"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { MenuCategory, MenuCurrency, Product } from "../types";
import styles from "./menu-workspace.module.css";

type EditableProduct = {
  categoryId: string;
  name: string;
  description: string | null;
  preparationStation: "CUISINE" | "BAR";
  currency: MenuCurrency;
  standardPriceAmount: string;
  isAvailable: boolean;
  isDailySpecial: boolean;
  isActive: boolean;
  displayOrder: number;
  zonePrices: Array<{ zone: "TERRACE" | "VIP"; priceAmount: string }>;
  variants: Array<{
    name: string;
    standardPriceAmount: string;
    isAvailable: boolean;
    displayOrder: number;
    zonePrices: Array<{ zone: "TERRACE" | "VIP"; priceAmount: string }>;
  }>;
  options: Array<{
    name: string;
    kind: "INCLUDED" | "PAID";
    priceAmount: string;
    isAvailable: boolean;
    displayOrder: number;
  }>;
};
type PageSize = 12 | 24 | 48;

function priceLabel(amount: string, currency: MenuCurrency) {
  const [whole = "0", fraction = ""] = amount.split(".");
  const grouped = new Intl.NumberFormat("fr-CD", {
    maximumFractionDigits: 0,
  }).format(BigInt(whole));
  const decimal =
    new Intl.NumberFormat("fr-CD")
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ",";
  const formatted = fraction ? `${grouped}${decimal}${fraction}` : grouped;
  return currency === "CDF" ? `${formatted} FC` : `$ ${formatted}`;
}

function MenuIcon({ children }: { children: ReactNode }) {
  return (
    <span className={styles.navIcon} aria-hidden="true">
      {children}
    </span>
  );
}

type VariantDraft = {
  name: string;
  standardPriceAmount: string;
  terrace: string;
  vip: string;
  isAvailable: boolean;
};
type OptionDraft = {
  name: string;
  kind: "INCLUDED" | "PAID";
  priceAmount: string;
  isAvailable: boolean;
};

function ProductForm({
  initial,
  categories,
  onClose,
  onSave,
}: {
  initial: Product | null;
  categories: MenuCategory[];
  onClose: () => void;
  onSave: (value: EditableProduct) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories[0]?.id ?? "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [station, setStation] = useState<"CUISINE" | "BAR">(
    initial?.preparationStation ?? "CUISINE",
  );
  const [amount, setAmount] = useState(initial?.price.amount ?? "");
  const [currency, setCurrency] = useState<MenuCurrency>(
    initial?.price.currency ?? "CDF",
  );
  const [available, setAvailable] = useState(initial?.available ?? true);
  const [dailyMenu, setDailyMenu] = useState(initial?.dailyMenu ?? false);
  const [active, setActive] = useState(initial?.active ?? true);
  const [displayOrder, setDisplayOrder] = useState(initial?.displayOrder ?? 0);
  const [terrace, setTerrace] = useState(
    initial?.zonePrices.terrace ? initial.zonePrices.terrace.amount : "",
  );
  const [vip, setVip] = useState(
    initial?.zonePrices.vip ? String(initial.zonePrices.vip.amount) : "",
  );
  const [variants, setVariants] = useState<VariantDraft[]>(
    initial?.variants
      .filter((variant) => variant.active)
      .map((variant) => ({
        name: variant.name,
        standardPriceAmount: variant.standardPriceAmount,
        terrace: variant.zonePrices.TERRACE ?? "",
        vip: variant.zonePrices.VIP ?? "",
        isAvailable: variant.available,
      })) ?? [],
  );
  const existingOptions = [
    ...(initial?.requiredAccompaniments ?? []),
    ...(initial?.paidExtras ?? []),
  ].filter((option) => option.active);
  const [options, setOptions] = useState<OptionDraft[]>(
    existingOptions.map((option) => ({
      name: option.name,
      kind: option.kind,
      priceAmount: option.priceAmount,
      isAvailable: option.available,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !categoryId || !/^\d{1,10}(?:\.\d{1,2})?$/.test(amount))
      return;
    setSaving(true);
    setFormError("");
    try {
      await onSave({
        categoryId,
        name: name.trim(),
        description: description.trim() || null,
        preparationStation: station,
        currency,
        standardPriceAmount: amount,
        isAvailable: available,
        isDailySpecial: dailyMenu,
        isActive: active,
        displayOrder,
        zonePrices: [
          ...(terrace
            ? [{ zone: "TERRACE" as const, priceAmount: terrace }]
            : []),
          ...(vip ? [{ zone: "VIP" as const, priceAmount: vip }] : []),
        ],
        variants: variants
          .filter((variant) => variant.name.trim())
          .map((variant, index) => ({
            name: variant.name.trim(),
            standardPriceAmount: variant.standardPriceAmount,
            isAvailable: variant.isAvailable,
            displayOrder: index,
            zonePrices: [
              ...(variant.terrace
                ? [{ zone: "TERRACE" as const, priceAmount: variant.terrace }]
                : []),
              ...(variant.vip
                ? [{ zone: "VIP" as const, priceAmount: variant.vip }]
                : []),
            ],
          })),
        options: options
          .filter((option) => option.name.trim())
          .map((option, index) => ({
            name: option.name.trim(),
            kind: option.kind,
            priceAmount: option.kind === "INCLUDED" ? "0" : option.priceAmount,
            isAvailable: option.isAvailable,
            displayOrder: index,
          })),
      });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
      setSaving(false);
    }
  }

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
      >
        <div className={styles.modalHeading}>
          <div>
            <span className={styles.eyebrow}>Catalogue du restaurant</span>
            <h2 id="product-form-title">
              {initial ? "Modifier la fiche" : "Nouvel article"}
            </h2>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        {formError && (
          <p className={styles.formNotice} role="alert">
            {formError}
          </p>
        )}
        <form className={styles.form} onSubmit={submit}>
          <label>
            Nom de l’article
            <input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex. Poulet braisé"
            />
          </label>
          <div className={styles.formGrid}>
            <label>
              Catégorie
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
              >
                {categories.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Poste de préparation
              <select
                value={station}
                onChange={(event) =>
                  setStation(event.target.value as "CUISINE" | "BAR")
                }
              >
                <option value="CUISINE">Cuisine</option>
                <option value="BAR">Bar</option>
              </select>
            </label>
            <label>
              Disponibilité
              <select
                value={available ? "available" : "unavailable"}
                onChange={(event) =>
                  setAvailable(event.target.value === "available")
                }
              >
                <option value="available">Disponible</option>
                <option value="unavailable">Indisponible</option>
              </select>
            </label>
          </div>
          <label>
            Ordre d’affichage
            <input
              type="number"
              min="0"
              max="100000"
              step="1"
              value={displayOrder}
              onChange={(event) => setDisplayOrder(Number(event.target.value))}
            />
          </label>
          <p className={styles.labelHint}>
            Tarif de zone absent : le prix Standard du produit sert de repli.
            Une variante sans tarif propre dans une zone utilise le tarif
            produit de cette zone, puis le Standard du produit.
          </p>
          {initial && currency !== initial.price.currency && (
            <p className={styles.formNotice} role="status">
              La devise change sans conversion. Les montants ont été vidés :
              ressaisissez chaque tarif et supplément dans {currency}.
            </p>
          )}
          <label>
            Description
            <textarea
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className={styles.formGrid}>
            <label>
              Prix de vente
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label>
              Devise
              <select
                value={currency}
                onChange={(event) => {
                  const nextCurrency = event.target.value as MenuCurrency;
                  if (nextCurrency !== currency) {
                    // Do not carry amounts across currencies. Every amount is
                    // deliberately re-entered in the newly selected currency.
                    setAmount("");
                    setTerrace("");
                    setVip("");
                    setVariants((current) =>
                      current.map((variant) => ({
                        ...variant,
                        standardPriceAmount: "",
                        terrace: "",
                        vip: "",
                      })),
                    );
                    setOptions((current) =>
                      current.map((option) => ({
                        ...option,
                        priceAmount: option.kind === "INCLUDED" ? "0" : "",
                      })),
                    );
                  }
                  setCurrency(nextCurrency);
                }}
              >
                <option value="CDF">CDF — FC</option>
                <option value="USD">USD — $</option>
              </select>
            </label>
          </div>
          <div className={styles.formGrid}>
            <label>
              Tarif terrasse ({currency})
              <input
                type="number"
                min="0"
                step={currency === "USD" ? "0.01" : "1"}
                value={terrace}
                onChange={(event) => setTerrace(event.target.value)}
                placeholder="Facultatif"
              />
            </label>
            <label>
              Tarif VIP ({currency})
              <input
                type="number"
                min="0"
                step={currency === "USD" ? "0.01" : "1"}
                value={vip}
                onChange={(event) => setVip(event.target.value)}
                placeholder="Facultatif"
              />
            </label>
          </div>
          <fieldset>
            <legend>Variantes et prix par zone</legend>
            {variants.map((variant, index) => (
              <div className={styles.formGrid} key={`variant-${index}`}>
                <input
                  aria-label="Nom de variante"
                  value={variant.name}
                  placeholder="Ex. Entier"
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  aria-label="Prix standard de variante"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variant.standardPriceAmount}
                  placeholder="Prix Standard"
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, standardPriceAmount: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  aria-label="Prix terrasse de variante"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variant.terrace}
                  placeholder="Terrasse (facultatif)"
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, terrace: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  aria-label="Prix VIP de variante"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variant.vip}
                  placeholder="VIP (facultatif)"
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, vip: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={variant.isAvailable}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, isAvailable: event.target.checked }
                            : item,
                        ),
                      )
                    }
                  />{" "}
                  Disponible
                </label>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() =>
                    setVariants((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  Retirer
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setVariants((current) => [
                  ...current,
                  {
                    name: "",
                    standardPriceAmount: "",
                    terrace: "",
                    vip: "",
                    isAvailable: true,
                  },
                ])
              }
            >
              ＋ Ajouter une variante
            </button>
          </fieldset>
          <fieldset>
            <legend>Accompagnements inclus et suppléments</legend>
            {options.map((option, index) => (
              <div className={styles.formGrid} key={`option-${index}`}>
                <input
                  aria-label="Nom d'option"
                  value={option.name}
                  placeholder="Ex. Riz"
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <select
                  aria-label="Type d'option"
                  value={option.kind}
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              kind: event.target.value as OptionDraft["kind"],
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="INCLUDED">Accompagnement inclus</option>
                  <option value="PAID">Supplément payant</option>
                </select>
                <input
                  aria-label="Prix d'option"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={option.kind === "INCLUDED"}
                  value={option.kind === "INCLUDED" ? "0" : option.priceAmount}
                  placeholder="Prix supplément"
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, priceAmount: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={option.isAvailable}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, isAvailable: event.target.checked }
                            : item,
                        ),
                      )
                    }
                  />{" "}
                  Disponible
                </label>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() =>
                    setOptions((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  Retirer
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setOptions((current) => [
                  ...current,
                  {
                    name: "",
                    kind: "INCLUDED",
                    priceAmount: "0",
                    isAvailable: true,
                  },
                ])
              }
            >
              ＋ Ajouter une option
            </button>
          </fieldset>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={dailyMenu}
              onChange={(event) => setDailyMenu(event.target.checked)}
            />{" "}
            Inclure dans le menu du jour
          </label>
          {initial && (
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />{" "}
              Article actif
            </label>
          )}
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onClose}
            >
              Annuler
            </button>
            <button type="submit" className={styles.primaryButton}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function MenuWorkspace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [permissions, setPermissions] = useState({
    manage: false,
    changeAvailability: false,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes");
  const [availability, setAvailability] = useState("all");
  const [pageSize, setPageSize] = useState<PageSize>(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");

  async function loadCatalog() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/menu", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payload?.error ?? "Catalogue indisponible.");
      setCategories(payload.categories as MenuCategory[]);
      setProducts(payload.products as Product[]);
      setPermissions(
        payload.permissions as { manage: boolean; changeAvailability: boolean },
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Impossible de charger le catalogue.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/menu", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(payload?.error ?? "Catalogue indisponible.");
        if (!active) return;
        setCategories(payload.categories as MenuCategory[]);
        setProducts(payload.products as Product[]);
        setPermissions(
          payload.permissions as {
            manage: boolean;
            changeAvailability: boolean;
          },
        );
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Impossible de charger le catalogue.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesQuery = product.name
          .toLocaleLowerCase("fr-CD")
          .includes(query.trim().toLocaleLowerCase("fr-CD"));
        const matchesCategory =
          category === "Toutes" || product.category === category;
        const matchesAvailability =
          availability === "all" ||
          product.available === (availability === "available");
        return matchesQuery && matchesCategory && matchesAvailability;
      }),
    [products, query, category, availability],
  );
  const pageCount = Math.ceil(filteredProducts.length / pageSize);
  const visiblePage = Math.min(currentPage, Math.max(1, pageCount));
  const pageProducts = filteredProducts.slice(
    (visiblePage - 1) * pageSize,
    visiblePage * pageSize,
  );
  const rangeStart =
    filteredProducts.length === 0 ? 0 : (visiblePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(visiblePage * pageSize, filteredProducts.length);

  async function saveProduct(value: EditableProduct) {
    const response = await fetch(
      editing ? `/api/menu/products/${editing.id}` : "/api/menu/products",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(payload?.error ?? "Enregistrement impossible.");
    await loadCatalog();
    setCurrentPage(1);
    setNotice(
      editing
        ? "Fiche mise à jour dans le catalogue du restaurant."
        : "Article créé dans le catalogue du restaurant.",
    );
    setEditing(undefined);
  }

  async function toggleAvailability(product: Product) {
    const response = await fetch(
      `/api/menu/products/${product.id}/availability`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isAvailable: !product.available }),
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(payload?.error ?? "Disponibilité non modifiée.");
      return;
    }
    await loadCatalog();
    setNotice(`Disponibilité mise à jour : ${product.name}.`);
  }

  async function deactivateProduct(product: Product) {
    const response = await fetch(`/api/menu/products/${product.id}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(payload?.error ?? "Désactivation impossible.");
      return;
    }
    await loadCatalog();
    setNotice(`Article désactivé sans suppression : ${product.name}.`);
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryError("");
    const response = await fetch("/api/menu/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: newCategoryName.trim(),
        displayOrder: categories.length,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setCategoryError(payload?.error ?? "Catégorie non créée.");
      return;
    }
    await loadCatalog();
    setNewCategoryName("");
    setCategoryDialogOpen(false);
    setNotice("Catégorie créée dans le catalogue du restaurant.");
  }

  return (
    <div className={`rp-dashboard ${styles.workspace}`}>
      <aside className="rp-sidebar">
        <Link
          className="rp-brand"
          href="/"
          aria-label="Resto+, retour au tableau de bord"
        >
          <Image
            className="rp-logo"
            src="/resto-plus-logo.jpeg"
            alt=""
            width={52}
            height={52}
            priority
          />
          <span>
            <span className="rp-brand-kicker">Resto+</span>
            <span className={styles.brandSub}>Gestion restaurant</span>
          </span>
        </Link>
        <nav className="rp-nav" aria-label="Navigation principale">
          <span className="rp-nav-caption">Espace de travail</span>
          <Link className="rp-nav-link" href="/">
            <MenuIcon>⌂</MenuIcon>
            <span>Tableau de bord</span>
          </Link>
          <Link
            className="rp-nav-link is-active"
            href="/menus"
            aria-current="page"
          >
            <MenuIcon>▤</MenuIcon>
            <span>Menus</span>
          </Link>
          <Link className="rp-nav-link" href="/tables">
            <MenuIcon>▦</MenuIcon>
            <span>Tables</span>
          </Link>
          <Link className="rp-nav-link" href="/commandes">
            <MenuIcon>≡</MenuIcon>
            <span>Commandes</span>
          </Link>
          <Link className="rp-nav-link" href="/cuisine">
            <MenuIcon>♨</MenuIcon>
            <span>Cuisine / Bar</span>
          </Link>
          <Link className="rp-nav-link" href="/caisse">
            <MenuIcon>▣</MenuIcon>
            <span>Caisse</span>
          </Link>
          <Link className="rp-nav-link" href="/stocks">
            <MenuIcon>◇</MenuIcon>
            <span>Stocks</span>
          </Link>
          <Link className="rp-nav-link" href="/rapports">
            <MenuIcon>▥</MenuIcon>
            <span>Rapports</span>
          </Link>
        </nav>
        <div className="rp-user-card">
          <div>
            <span>JD</span>
            <section>
              <p>Jean Démonstration</p>
              <p>Session de démonstration</p>
            </section>
          </div>
        </div>
      </aside>

      <main className={`rp-main ${styles.main}`}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.breadcrumb}>
              Gestion <span>/</span> Menus et produits
            </p>
            <h1>Menus et produits</h1>
            <p className={styles.subtitle}>
              Gérez les articles, les tarifs et la carte du jour.
            </p>
          </div>
          <div className={styles.headerActions}>
            {permissions.manage && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setCategoryDialogOpen(true)}
              >
                ＋ Catégorie
              </button>
            )}
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setNotice(
                  "La duplication de fiche sera ajoutée dans une prochaine étape.",
                )
              }
            >
              ⧉ <span>Dupliquer</span>
            </button>
            <button
              type="button"
              disabled={
                !permissions.manage ||
                categories.filter((item) => item.active).length === 0
              }
              className={styles.primaryButton}
              onClick={() => setEditing(null)}
            >
              ＋ Ajouter un article
            </button>
          </div>
        </header>

        <div className={styles.demoNotice}>
          <span className={styles.demoMark}>Catalogue</span>
          <p>
            <strong>Catalogue persistant</strong> — les données sont chargées
            depuis le restaurant de la session. Les exemples des maquettes ne
            sont pas utilisés comme données réelles.
          </p>
          <span className={styles.demoCount}>
            {loading ? "Chargement…" : `${products.length} articles`}
          </span>
        </div>
        {loadError && (
          <p className={styles.actionNotice} role="alert">
            {loadError}
          </p>
        )}
        {notice && (
          <p className={styles.actionNotice} role="status">
            {notice}
          </p>
        )}

        <section className={styles.summaryRow} aria-label="Résumé du catalogue">
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Articles affichés</span>
            <strong>{products.length}</strong>
            <span>Catalogue du restaurant</span>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Disponibles</span>
            <strong>{products.filter((item) => item.available).length}</strong>
            <span>État actuel</span>
          </article>
          <article className={`${styles.summaryCard} ${styles.dailyCard}`}>
            <span className={styles.summaryLabel}>Menu du jour</span>
            <strong>
              {products.filter((item) => item.dailyMenu).length}{" "}
              <small>article</small>
            </strong>
            <span>État actuel du catalogue</span>
          </article>
        </section>

        <section className={styles.catalogPanel}>
          <div className={styles.catalogHeading}>
            <div>
              <h2>Carte du restaurant</h2>
              <p>Articles, catégories et tarifs du restaurant</p>
            </div>
            <button
              className={styles.importButton}
              type="button"
              onClick={() =>
                setNotice(
                  "Import Excel : emplacement de démonstration. Le traitement du fichier n’est pas activé.",
                )
              }
            >
              ⇧ <span>Importer Excel</span>
              <small>Bientôt</small>
            </button>
          </div>
          <div className={styles.filters}>
            <label className={styles.searchBox}>
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Rechercher un produit"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Rechercher un produit"
              />
            </label>
            <label className={styles.filterSelect}>
              <span>Catégorie</span>
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option>Toutes</option>
                {categories
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
              </select>
            </label>
            <label className={styles.filterSelect}>
              <span>Disponibilité</span>
              <select
                value={availability}
                onChange={(event) => {
                  setAvailability(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">Tous les états</option>
                <option value="available">Disponible</option>
                <option value="unavailable">Indisponible</option>
              </select>
            </label>
            <span className={styles.resultCount}>
              {filteredProducts.length} résultat
              {filteredProducts.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className={styles.productGrid}>
            {pageProducts.map((product) => (
              <article className={styles.productCard} key={product.id}>
                <div className={styles.productVisual}>
                  <span className={styles.productMonogram}>
                    {product.photoLabel}
                  </span>
                  <span
                    className={`${styles.availability} ${product.available ? styles.isAvailable : styles.isUnavailable}`}
                  >
                    <i />
                    {product.available ? "Disponible" : "Indisponible"}
                  </span>
                  {product.dailyMenu && (
                    <span className={styles.dailyBadge}>Menu du jour</span>
                  )}
                </div>
                <div className={styles.productContent}>
                  <div className={styles.productTitle}>
                    <div>
                      <span className={styles.categoryTag}>
                        {product.category}
                      </span>
                      {!product.active && (
                        <span className={styles.labelHint}>Désactivé</span>
                      )}
                      <h3>{product.name}</h3>
                    </div>
                    {permissions.manage && (
                      <button
                        className={styles.moreButton}
                        type="button"
                        aria-label={`Options pour ${product.name}`}
                        aria-expanded={openActionId === product.id}
                        onClick={() =>
                          setOpenActionId((id) =>
                            id === product.id ? null : product.id,
                          )
                        }
                      >
                        •••
                      </button>
                    )}
                    {(permissions.manage || permissions.changeAvailability) &&
                      openActionId === product.id && (
                        <div className={styles.actionMenu}>
                          {permissions.manage && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(product);
                                setOpenActionId(null);
                              }}
                            >
                              Modifier la fiche
                            </button>
                          )}
                          {product.active && permissions.changeAvailability && (
                            <button
                              type="button"
                              onClick={() => {
                                void toggleAvailability(product);
                                setOpenActionId(null);
                              }}
                            >
                              {product.available
                                ? "Rendre indisponible"
                                : "Rendre disponible"}
                            </button>
                          )}
                          {permissions.manage && product.active && (
                            <button
                              type="button"
                              onClick={() => {
                                void deactivateProduct(product);
                                setOpenActionId(null);
                              }}
                            >
                              Désactiver sans supprimer
                            </button>
                          )}
                          {permissions.manage && (
                            <button
                              type="button"
                              onClick={() => {
                                setNotice(
                                  "Duplication : action simulée, aucune nouvelle fiche n’a été persistée.",
                                );
                                setOpenActionId(null);
                              }}
                            >
                              Dupliquer <span>Bientôt</span>
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                  <div className={styles.priceLine}>
                    <strong>
                      {priceLabel(product.price.amount, product.price.currency)}
                    </strong>
                    <span>Prix Standard · {product.price.currency}</span>
                  </div>
                  <div className={styles.zonePrices}>
                    <span>
                      Terrasse{" "}
                      <strong>
                        {product.zonePrices.terrace
                          ? priceLabel(
                              product.zonePrices.terrace.amount,
                              product.zonePrices.terrace.currency,
                            )
                          : "—"}
                      </strong>
                    </span>
                    <span>
                      VIP{" "}
                      <strong>
                        {product.zonePrices.vip
                          ? priceLabel(
                              product.zonePrices.vip.amount,
                              product.zonePrices.vip.currency,
                            )
                          : "—"}
                      </strong>
                    </span>
                  </div>
                  <p className={styles.productDetails}>
                    {product.variants.length} var. ·{" "}
                    {product.requiredAccompaniments.length} accomp. ·{" "}
                    {product.paidExtras.length} suppl.
                  </p>
                  <div className={styles.cardActions}>
                    {permissions.manage && (
                      <button
                        type="button"
                        className={styles.editButton}
                        onClick={() => setEditing(product)}
                      >
                        Modifier
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className={styles.emptyState}>
              <span>⌕</span>
              <h3>Aucun article trouvé</h3>
              <p>Essayez un autre terme ou une autre catégorie.</p>
            </div>
          )}
          <nav
            className={styles.pagination}
            aria-label="Pagination des produits"
          >
            <div className={styles.paginationSummary}>
              <span>
                {rangeStart}–{rangeEnd} sur {filteredProducts.length} produits
              </span>
              <label>
                Par page
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value) as PageSize);
                    setCurrentPage(1);
                  }}
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </label>
            </div>
            <div className={styles.pageControls}>
              <button
                type="button"
                className={styles.pageArrow}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={visiblePage <= 1}
                aria-label="Page précédente"
              >
                ← <span>Précédent</span>
              </button>
              <div className={styles.pageNumbers}>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                  (page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      aria-label={`Page ${page}`}
                      aria-current={visiblePage === page ? "page" : undefined}
                      className={
                        visiblePage === page ? styles.activePage : undefined
                      }
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>
              <button
                type="button"
                className={styles.pageArrow}
                onClick={() =>
                  setCurrentPage((page) => Math.min(pageCount, page + 1))
                }
                disabled={visiblePage >= pageCount}
                aria-label="Page suivante"
              >
                <span>Suivant</span> →
              </button>
            </div>
          </nav>
        </section>

        <section className={styles.bottomGrid}>
          <article className={styles.infoPanel}>
            <div className={styles.infoPanelHeading}>
              <span className={styles.infoIcon}>☼</span>
              <div>
                <h2>Menu du jour</h2>
                <p>Articles marqués dans le catalogue</p>
              </div>
            </div>
            <div className={styles.dailyList}>
              {products
                .filter((product) => product.dailyMenu)
                .map((product) => (
                  <div key={product.id}>
                    <span>{product.name}</span>
                    <strong>
                      {priceLabel(product.price.amount, product.price.currency)}
                    </strong>
                  </div>
                ))}
            </div>
            <p className={styles.panelFootnote}>
              La période de publication reste à définir.
            </p>
          </article>
          <article className={styles.infoPanel}>
            <div className={styles.infoPanelHeading}>
              <span className={`${styles.infoIcon} ${styles.mutedIcon}`}>
                ⇧
              </span>
              <div>
                <h2>Importation Excel</h2>
                <p>Préparation prévue</p>
              </div>
            </div>
            <div className={styles.uploadPlaceholder}>
              <span className={styles.uploadGlyph}>＋</span>
              <div>
                <strong>Déposez votre fichier .xlsx ici</strong>
                <p>
                  Le modèle et le rapport de lignes en erreur seront disponibles
                  dans une prochaine étape.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setNotice(
                    "Import désactivé : cette étape est une présentation visuelle uniquement.",
                  )
                }
              >
                Choisir un fichier
              </button>
            </div>
          </article>
        </section>
        <footer className={styles.footer}>
          Resto+ · Catalogue persistant · Les paiements ne sont pas intégrés
        </footer>
      </main>

      {editing !== undefined && permissions.manage && (
        <ProductForm
          key={editing?.id ?? "new-product"}
          initial={editing}
          categories={categories.filter((item) => item.active)}
          onClose={() => setEditing(undefined)}
          onSave={saveProduct}
        />
      )}
      {categoryDialogOpen && permissions.manage && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setCategoryDialogOpen(false)
          }
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-form-title"
          >
            <div className={styles.modalHeading}>
              <div>
                <span className={styles.eyebrow}>Catalogue du restaurant</span>
                <h2 id="category-form-title">Nouvelle catégorie</h2>
              </div>
              <button
                className={styles.closeButton}
                type="button"
                onClick={() => setCategoryDialogOpen(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            {categoryError && (
              <p className={styles.formNotice} role="alert">
                {categoryError}
              </p>
            )}
            <form className={styles.form} onSubmit={createCategory}>
              <label>
                Nom de la catégorie
                <input
                  autoFocus
                  required
                  maxLength={100}
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                />
              </label>
              <div className={styles.formActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setCategoryDialogOpen(false)}
                >
                  Annuler
                </button>
                <button className={styles.primaryButton} type="submit">
                  Créer la catégorie
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
