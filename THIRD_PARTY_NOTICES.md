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
| [Tailwind CSS](https://tailwindcss.com/) | MIT | Styling. |

Reference-only projects (not copied into this repository):

- `5g-cpe-signal-monitor` is GPL-3.0. Only public behavior, interface ideas and
  testing approaches were considered; no GPL source, styles or assets were copied.
- `ha-huawei-router-5g-monitor` is Apache-2.0 and used as background reference.
- Home Assistant's `huawei_lte` integration is Apache-2.0 and used as background
  reference for integration behavior.
- `cpe-band-scan` has not been used for code. Its license must be checked before
  any Band Lock implementation.
