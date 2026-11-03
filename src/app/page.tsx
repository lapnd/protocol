import { CATALOG } from "../explainers";
import { Hub } from "../kit/components/Hub";
import { SITE } from "../site.config";

export default function HubPage() {
  return <Hub site={SITE} catalog={CATALOG} />;
}
