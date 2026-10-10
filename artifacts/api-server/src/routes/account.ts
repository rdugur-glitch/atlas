import { Router, type ErrorRequestHandler } from "express";
import { GetAtlasAccountResponse, ImportAtlasLegacyBody, ImportAtlasLegacyResponse } from "@workspace/api-zod";
import { accountStatus, importLegacy, legacyId, bindSession, requireAccount, accountWorkspace, sessionCookieOptions } from "../lib/atlas-account";
import { sameOrigin, AtlasFailure } from "../lib/atlas-store";
const router = Router();
router.use(sameOrigin, requireAccount);
router.get("/", async (req, res) => {
  const status = await accountStatus(res.locals.atlasUserId, legacyId(req));
  bindSession(req, res);
  res.json(GetAtlasAccountResponse.parse(status));
});
router.post("/import", accountWorkspace, async (req, res) => {
  if (!ImportAtlasLegacyBody.safeParse(req.body).success) throw new AtlasFailure("Eski kayıtları hesabınıza aktarmak için açık onayınız gerekli.");
  const result = await importLegacy(res.locals.atlasUserId, legacyId(req));
  res.clearCookie("atlas_workspace", sessionCookieOptions(req));
  res.json(ImportAtlasLegacyResponse.parse(result));
});
router.use(((error, _req, res, _next) => {
  if (error instanceof AtlasFailure) res.status(error.status).json({ error: error.message, code: error.code });
  else res.status(500).json({ error: "Hesap işlemi tamamlanamadı. Mevcut kayıtlarınız korunuyor; tekrar deneyin." });
}) as ErrorRequestHandler);
export default router;
