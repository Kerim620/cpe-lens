# Third-party notices

CPE Lens is MIT licensed. Runtime and development dependencies retain their own
licenses. The main runtime dependencies are listed below; review each project's
license before redistribution.

| Dependency | License | Usage |
| --- | --- | --- |
| [huawei-lte-api](https://github.com/Salamek/huawei-lte-api) | LGPL-3.0 | Independent Python dependency wrapped by `cpe_lens.adapters.huawei`; no source code copied into this repository. |
| [FastAPI](https://fastapi.tiangolo.com/) | MIT | HTTP API. |
| [Pydantic](https://docs.pydantic.dev/) | MIT | Request/response models. |
| [Uvicorn](https://www.uvicorn.org/) | BSD-3-Clause | ASGI server. |
| [React](https://react.dev/) | MIT | Frontend UI. |
| [React Router](https://reactrouter.com/) | MIT | Client-side navigation. |
| [Vite](https://vite.dev/) | MIT | Frontend build and dev server. |
| [Tailwind CSS](https://tailwindcss.com/) | MIT | Styling and design tokens. |
| [shadcn/ui](https://ui.shadcn.com/) | MIT | Local component patterns for buttons, cards, dialogs, forms, menus and tables. |
| [Radix UI Primitives](https://www.radix-ui.com/primitives) | MIT | Accessible dialog, select, tabs, checkbox, dropdown and label primitives used by the local UI components. |
| [Tremor Raw](https://github.com/tremorlabs/tremor) | Apache-2.0 | Chart component structure and dashboard patterns; chart code in `frontend/src/components/charts/chart.tsx` is adapted and rebuilt on Recharts. |
| [Recharts](https://recharts.org/) | MIT | SVG chart rendering. |
| [Lucide](https://lucide.dev/) | ISC | Static icon imports. |
| [class-variance-authority](https://github.com/joe-bell/cva) | Apache-2.0 | Component variants. |
| [tailwind-merge](https://github.com/dcastil/tailwind-merge) | MIT | Class conflict resolution. |

Frontend UI components in `frontend/src/components/ui/` follow the shadcn/ui local-source
approach (MIT). Radix UI primitives are consumed as npm dependencies under MIT. The chart
primitives in `frontend/src/components/charts/chart.tsx` are adapted from Tremor Raw
(Apache-2.0) and use Recharts (MIT); the adaptation is limited to the chart shell, tooltip,
legend, grid and theme-token integration. The Apache-2.0 license text is
included in `LICENSES/Apache-2.0.txt`; see `NOTICE` for attribution.

Reference-only projects (not copied into this repository):

- `5g-cpe-signal-monitor` is GPL-3.0. Only public behavior, interface ideas and
  testing approaches were considered; no GPL source, styles or assets were copied.
- `ha-huawei-router-5g-monitor` is Apache-2.0 and used as background reference.
- Home Assistant's `huawei_lte` integration is Apache-2.0 and used as background
  reference for integration behavior.
- `cpe-band-scan` has not been used for code. Its license must be checked before
  any Band Lock implementation.
