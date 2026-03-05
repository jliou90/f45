
# Import models so Alembic sees them (DO NOT remove)
# Accounting (GL spine)
from app.modules.accounting.models import (  # noqa: F401
    AcctAccount,
    AcctJournal,
    AcctJournalLine,
    AcctOpsState,
    AcctPeriod,
    AcctPostingBatch,
    AcctPostingLock,
    AcctReversalLink,
    AcctWorkflowRecord,
)
from app.modules.admin.models import (  # noqa: F401
    FeatureFlag,
    InviteToken,
    PasswordResetToken,
    RoleFeatureOverride,
    TenantFeatureOverride,
    TenantProfile,
    UserFeatureOverride,
)

# Platform audit
from app.modules.audit.models import AuditEvent, AuditLog  # noqa: F401
from app.modules.comms.models import OutboundCommunication  # noqa: F401
from app.modules.dms.models import Appointment, Customer, CustomerCrmProfile, Vehicle  # noqa: F401
from app.modules.documents.models import (  # noqa: F401
    Document,
    DocumentAttachment,
    DocumentAttachmentLink,
)

# Event-sourcing backbone + projections
from app.modules.eventstore.models import Event, Stream  # noqa: F401
from app.modules.identity.models import User  # noqa: F401
from app.modules.integrations.models import (  # noqa: F401
    IdempotencyKey,
    IdempotencyRecord,
    OutboxMessage,
    WebhookSubscription,
)
from app.modules.inventory.models import (  # noqa: F401
    InventoryOrderBatch,
    InventoryOrderBatchLine,
    InventorySupplyItem,
)
from app.modules.portal.models import PortalUserPrefs  # noqa: F401
from app.modules.jobs.models import Job  # noqa: F401
from app.modules.rbac.models import PermissionGrant, Role, RolePermission  # noqa: F401
from app.modules.tenancy.models import (
    Membership,  # noqa: F401
    Tenant,  # noqa: F401
)
