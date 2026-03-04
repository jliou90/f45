import { useParams } from "react-router-dom";
import { openDrawer } from "@kutm/ui-platform";

export function CustomerPage() {
  const { customerId = "c1" } = useParams();

  return (
    <section>
      <h2>Customer {customerId}</h2>
      <button data-testid="page-open-edit" onClick={() => openDrawer("customer.edit", { customerId })}>
        Edit Customer
      </button>
    </section>
  );
}
