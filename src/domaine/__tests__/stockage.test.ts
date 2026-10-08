import { describe, expect, it } from "vitest";
import { scenarioExemple } from "../fabrique";
import { imagesDuScenario, imagesUtilisees, importerJson, normaliserScenario } from "../stockage";

const PIXEL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

describe("photos des étapes", () => {
  it("garde identifiants et légendes, écarte ce qui n'est pas une photo", () => {
    const brut = structuredClone(scenarioExemple()) as unknown as { etapes: Record<string, unknown>[] };
    brut.etapes[1]!.images = [{ id: "img-1", legende: "Terminal 3" }, { legende: "sans id" }, "n'importe quoi"];
    delete brut.etapes[2]!.images; // scénario de la v1 : pas de champ images
    const s = normaliserScenario(brut)!;
    expect(s.etapes[1]!.images).toEqual([{ id: "img-1", legende: "Terminal 3" }]);
    expect(s.etapes[2]!.images).toEqual([]);
    expect([...imagesUtilisees([s])]).toEqual(["img-1"]);
  });

  it("exporte puis réimporte un scénario avec ses photos", async () => {
    const s = scenarioExemple();
    s.etapes[1]!.images = [{ id: "img-1", legende: "Terminal 3" }];
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
    expect(scenario.etapes[1]!.images).toEqual([{ id: "img-1", legende: "Terminal 3" }]);
    expect(importees.get("img-1")).toBe(PIXEL);
  });

  it("lit encore les fichiers .json de la v1, sans photos", async () => {
    const v1 = { format: "carnet-de-route", version: 1, scenario: scenarioExemple() };
    const { scenario, images } = await importerJson(new File([JSON.stringify(v1)], "v1.json"));
    expect(scenario.etapes.length).toBe(13);
    expect(images.size).toBe(0);
  });
});
