import type { AppEnv, User } from "../../env";
import { Layout } from "../layout";

export function ErrorPage({
  env,
  user,
  status,
  message,
}: {
  env: AppEnv;
  user?: User | undefined;
  status: number;
  message: string;
}) {
  const title =
    status === 404 ? "Page not found" : status === 403 ? "Not allowed" : "Something went wrong";
  return (
    <Layout env={env} title={title} user={user}>
      <section class="narrow">
        <h1>{title}</h1>
        <p>{message}</p>
        <p>
          <a href="/">Back to the home page</a>
        </p>
      </section>
    </Layout>
  );
}
