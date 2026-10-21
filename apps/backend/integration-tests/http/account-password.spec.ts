import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IApiKeyModuleService } from "@medusajs/framework/types";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-account-password-integration",
  testSuite: ({ api, getContainer }) => {
    describe("changing a password while signed in", () => {
      it("needs the current password, then only the new one works", async () => {
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: "Password test",
            type: "publishable",
            created_by: "test",
          });
        const keyHeader = { "x-publishable-api-key": key.token };
        const email = "changer@example.com";
        const oldPassword = "old-password-123";
        const newPassword = "new-password-456";

        const {
          data: { token: registration },
        } = await api.post("/auth/customer/emailpass/register", {
          email,
          password: oldPassword,
        });
        await api.post(
          "/store/customers",
          { email },
          {
            headers: { ...keyHeader, Authorization: `Bearer ${registration}` },
          },
        );
        const {
          data: { token },
        } = await api.post("/auth/customer/emailpass", {
          email,
          password: oldPassword,
        });
        const auth = {
          headers: { ...keyHeader, Authorization: `Bearer ${token}` },
        };

        expect(
          (await api.get("/store/customers/me/password", auth)).data,
        ).toEqual({ has_password: true, google: false });

        await expect(
          api.post(
            "/store/customers/me/password/change",
            { current_password: "wrong-password", new_password: newPassword },
            auth,
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });
        await expect(
          api.post(
            "/store/customers/me/password/change",
            { current_password: oldPassword, new_password: "short" },
            auth,
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });

        await api
          .post(
            "/store/customers/me/password/change",
            { current_password: oldPassword, new_password: newPassword },
            auth,
          )
          .catch((error) => {
            throw new Error(JSON.stringify(error.response?.data));
          });

        await expect(
          api.post("/auth/customer/emailpass", {
            email,
            password: oldPassword,
          }),
        ).rejects.toMatchObject({ response: { status: 401 } });
        const { data } = await api.post("/auth/customer/emailpass", {
          email,
          password: newPassword,
        });
        expect(data.token).toEqual(expect.any(String));

        await expect(
          api.post(
            "/store/customers/me/password/change",
            { current_password: oldPassword, new_password: newPassword },
            { headers: keyHeader },
          ),
        ).rejects.toMatchObject({ response: { status: 401 } });
      });
    });
  },
});
