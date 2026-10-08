import { describe, expect, it } from "vitest";
import { ID_EXEMPLE, nouveauScenario, scenarioExemple } from "../fabrique";
import { avecExemple, imagesDuScenario, imagesUtilisees, importerJson, normaliserScenario } from "../stockage";

const PIXEL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

describe("photos des étapes", () => {
  it("garde identifiants et légendes, écarte ce qui n'est pas une photo", () => {
    const brut = structuredClone(scenarioExemple()) as unknown as { etapes: Record<string, unknown>[] };
    for (const e of brut.etapes) e.images = [];
    brut.etapes[1]!.images = [
      { id: "img-1", legende: "Terminal 3", placement: "sur", ratio: 1.5 },
      { id: "img-2", legende: "", ratio: -3 }, // ancienne photo, ratio absurde
      { legende: "sans id" },
      "n'importe quoi",
    ];
    delete brut.etapes[2]!.images; // scénario de la v1 : pas de champ images
    const s = normaliserScenario(brut)!;
    expect(s.etapes[1]!.images).toEqual([
      { id: "img-1", legende: "Terminal 3", placement: "sur", ratio: 1.5 },
      { id: "img-2", legende: "", placement: "sous" },
    ]);
    expect(s.etapes[2]!.images).toEqual([]);
    expect([...imagesUtilisees([s])]).toEqual(["img-1", "img-2"]);
  });

  it("exporte puis réimporte un scénario avec ses photos", async () => {
    const s = scenarioExemple();
    s.etapes[1]!.images = [{ id: "img-1", legende: "Terminal 3", placement: "sous", ratio: 1.5 }];
    const images = new Map([
      ["img-1", PIXEL],
      ["img-autre-scenario", PIXEL],
    ]);
    const exporte = { format: "carnet-de-route", version: 2, scenario: s, images: imagesDuScenario(s, images) };
    // Seules les photos du scénario partent dans le fichier.
    expect(Object.keys(exporte.images)).toEqual(["img-1"]);

    const fichier = new File([JSON.stringify(exporte)], "omra.json", { type: "application/json" });
    const { scenario, images: importees } = await importerJson(fichier);
    expect(scenario.id).not.toBe(s.id);
    expect(scenario.etapes[1]!.images).toEqual([{ id: "img-1", legende: "Terminal 3", placement: "sous", ratio: 1.5 }]);
    expect(importees.get("img-1")).toBe(PIXEL);
  });

  it("donne des photos d'exemple à plusieurs étapes, dans des formats variés", () => {
    const photos = scenarioExemple().etapes.flatMap((e) => e.images);
    expect(photos.length).toBe(7);
    expect(new Set(photos.map((p) => p.ratio)).size).toBeGreaterThanOrEqual(4);
    expect(photos.some((p) => p.placement === "sur") && photos.some((p) => p.placement === "sous")).toBe(true);
  });

  it("lit encore les fichiers .json de la v1, sans photos", async () => {
    const v1 = { format: "carnet-de-route", version: 1, scenario: scenarioExemple() };
    const { scenario, images } = await importerJson(new File([JSON.stringify(v1)], "v1.json"));
    expect(scenario.etapes.length).toBe(13);
    expect(images.size).toBe(0);
  });
});

describe("scénario d'exemple intégré", () => {
  it("est ajouté en tête quand il manque", () => {
    const perso = nouveauScenario();
    const etat = avecExemple({ scenarios: [perso], actif: perso.id });
    expect(etat.scenarios.map((s) => s.id)).toEqual([ID_EXEMPLE, perso.id]);
    expect(etat.actif).toBe(perso.id);
  });

  it("ne revient pas quand on l'a supprimé exprès", () => {
    const perso = nouveauScenario();
    const etat = avecExemple({ scenarios: [perso], actif: perso.id, exempleRetire: true });
    expect(etat.scenarios.map((s) => s.id)).toEqual([perso.id]);
  });

  it("n'est pas dupliqué s'il est déjà là, même modifié", () => {
    const exemple = { ...scenarioExemple(), nom: "Mon Omra modifiée" };
    const etat = avecExemple({ scenarios: [exemple], actif: exemple.id });
    expect(etat.scenarios).toEqual([exemple]);
  });
});
