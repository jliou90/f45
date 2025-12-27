#!/bin/bash

echo "🏗️  Creating DMS Enterprise Directory Structure..."

# Root level
mkdir -p .github/workflows
mkdir -p .github/ISSUE_TEMPLATE
mkdir -p docs/{architecture,api,guides,decisions}
mkdir -p scripts/{dev,build,deploy}

# Packages - Shared libraries
mkdir -p packages/database/prisma/{schema,seeds,migrations}
mkdir -p packages/database/src/types

mkdir -p packages/types/src/{api/{requests,responses},models,enums,common}

mkdir -p packages/ui/src/{components,hooks,utils,styles/{tokens,base,themes}}
mkdir -p packages/ui/storybook

mkdir -p packages/api-client/src/{endpoints,interceptors,utils}

mkdir -p packages/validation/src/{schemas/{auth,customers,appointments,workorders,parts},rules,utils}

mkdir -p packages/utils/src/{formatters/{currency,date,phone,string},validators,strings,numbers}

mkdir -p packages/constants/src

mkdir -p packages/config/src

# Backend API service
mkdir -p services/api/src/{config,core/{database,cache,queue,logging},middleware/{auth,validation,security,logging}}

# Backend modules
mkdir -p services/api/src/modules/auth/{controllers,services,repositories,dto,validators,mappers,guards,strategies,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/users/{controllers,services,repositories,dto,validators,mappers,guards,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/customers/{controllers,services,repositories,dto,validators,mappers,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/appointments/{controllers,services,repositories,dto,validators,mappers,constants,types,utils/{slots,conflicts,reminders},tests/{unit,integration}}

mkdir -p services/api/src/modules/workorders/{controllers,services,repositories,dto,validators,mappers,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/parts/{controllers,services,repositories,dto,validators,mappers,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/quotes/{controllers,services,repositories,dto,validators,mappers,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/sales/{controllers,services,repositories,dto,validators,mappers,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/fi/{controllers,services,repositories,dto,validators,mappers,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/communications/{controllers,services,repositories,dto,validators,mappers,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/reports/{controllers,services,repositories,dto,validators,mappers,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/dashboard/{controllers,services,repositories,dto,validators,mappers,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/modules/settings/{controllers,services,repositories,dto,validators,mappers,constants,types,utils,tests/{unit,integration}}

mkdir -p services/api/src/shared/{decorators,filters,interceptors,pipes,guards}

# Frontend web application
mkdir -p apps/web/public/{images,icons,fonts}

mkdir -p apps/web/src/app/\(auth\)/{login,register,forgot-password}

mkdir -p apps/web/src/app/\(dashboard\)/customers/{_components,_hooks,_utils,_constants,_types,new}
mkdir -p apps/web/src/app/\(dashboard\)/customers/\[id\]/{edit,vehicles,history}

mkdir -p apps/web/src/app/\(dashboard\)/service/{scheduler,quotes,work-orders}
mkdir -p apps/web/src/app/\(dashboard\)/service/scheduler/{_components,_hooks,_utils,_constants,_types}
mkdir -p apps/web/src/app/\(dashboard\)/service/work-orders/{_components,_hooks,_utils,_constants,_types,new}
mkdir -p apps/web/src/app/\(dashboard\)/service/work-orders/\[id\]

mkdir -p apps/web/src/app/\(dashboard\)/parts/{inventory,vendors,purchase-orders}
mkdir -p apps/web/src/app/\(dashboard\)/parts/inventory/{_components,_hooks,_utils,_constants,_types,new}
mkdir -p apps/web/src/app/\(dashboard\)/parts/inventory/\[id\]

mkdir -p apps/web/src/app/\(dashboard\)/sales/{leads,inventory,deals}

mkdir -p apps/web/src/app/\(dashboard\)/fi/{products,lenders,deals}

mkdir -p apps/web/src/app/\(dashboard\)/communications

mkdir -p apps/web/src/app/\(dashboard\)/reports/{sales,service,financial}

mkdir -p apps/web/src/app/\(dashboard\)/users/{new}
mkdir -p apps/web/src/app/\(dashboard\)/users/\[id\]

mkdir -p apps/web/src/app/\(dashboard\)/settings/{general,organization,locations,users,roles,security,integrations,notifications,billing}

mkdir -p apps/web/src/app/\(dashboard\)/profile

mkdir -p apps/web/src/components/layout/{Sidebar,Header,Footer,MobileMenu,Breadcrumbs,UserMenu}

mkdir -p apps/web/src/components/auth

mkdir -p apps/web/src/components/dashboard

mkdir -p apps/web/src/hooks

mkdir -p apps/web/src/utils/{api/{client,interceptors,endpoints},formatters,validators,helpers}

mkdir -p apps/web/src/styles/{tokens,base,themes}

mkdir -p apps/web/src/constants

mkdir -p apps/web/src/types

mkdir -p apps/web/tests/{mocks,fixtures,utils}

echo "✅ Directory structure created!"
echo "📊 Counting directories..."
find . -type d | wc -l
