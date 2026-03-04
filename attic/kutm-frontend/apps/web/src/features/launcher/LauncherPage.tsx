import { Link, useNavigate } from "react-router-dom";
import { useMe } from "@kutm/core";
import { openDrawer, openModal } from "@kutm/ui-platform";

export function LauncherPage() {
  const navigate = useNavigate();
  const me = useMe();

  return (
    <section>
      <h2>Launcher</h2>
      {me.isLoading ? <p>Loading /me ...</p> : null}
      {me.data ? (
        <>
          <p data-testid="launcher-user">{me.data.user.name}</p>
          <div className="row">
            <button
              data-testid="open-picker"
              onClick={async () => {
                const picked = await openModal("customer.picker", { initialQuery: "Alex" });
                if (picked) {
                  navigate(`/customers/${picked.customerId}`);
                }
              }}
            >
              Open Customer Picker
            </button>
            <button
              data-testid="open-edit"
              onClick={() => openDrawer("customer.edit", { customerId: "c1" })}
            >
              Open Customer Edit Drawer
            </button>
            <Link to="/customers/c1">Go to customer route</Link>
          </div>
        </>
      ) : null}
    </section>
  );
}
