# Changelog

## [1.11.1](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.11.1) (2026-03-16)


### Features

* add logging for login, logout, and TOTP verification events ([4bce6da](https://github.com/jordanlambrecht/tracker-tracker/commit/4bce6da45face537047df79d394686af49398360))
* enhance api error handling for multiple adapters ([1891cef](https://github.com/jordanlambrecht/tracker-tracker/commit/1891cef6735e7ef0cf28bed1448a1ba0f35fb0da))
* ip ban check for tracker api calls ([39e9554](https://github.com/jordanlambrecht/tracker-tracker/commit/39e95548f89689b17eb0308255c9d1c204ac3254))
* log auth events for login, TOTP, and logout ([de3c0ce](https://github.com/jordanlambrecht/tracker-tracker/commit/de3c0cec82bc5d05444fb3e3a804c4cc1878e2ba))
* show last seen and error state on download client cards ([#35](https://github.com/jordanlambrecht/tracker-tracker/issues/35)) ([36c07e6](https://github.com/jordanlambrecht/tracker-tracker/commit/36c07e689fc93fd7f1d9589d0f72bd506102e92c))
* show per-endpoint debug info in tracker debug poll ([f088582](https://github.com/jordanlambrecht/tracker-tracker/commit/f088582119b1a9c0bb4e40c3088ecaf05aa12dbb))
* update UploadPolarChart with html escaping ([9720759](https://github.com/jordanlambrecht/tracker-tracker/commit/972075966b8ab6e3d092c06c725d407857c4fccc))


### Bug Fixes

* add --ignore-scripts option to pnpm prune in Dockerfile ([259ed39](https://github.com/jordanlambrecht/tracker-tracker/commit/259ed39e418080652e410227a227399c2444275c))
* **ci:** add tsx as devDep and use pnpm exec instead of npx ([e9c25eb](https://github.com/jordanlambrecht/tracker-tracker/commit/e9c25eb7d0e4431f4a897c55e277eb6eaed5afed))
* **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
* disable clients with cleared credentials on restore ([14ee232](https://github.com/jordanlambrecht/tracker-tracker/commit/14ee232e1800e6e46ed89f57dcfb4a0e3a4f50a2))
* favicon wasnt showing in production ([d21622d](https://github.com/jordanlambrecht/tracker-tracker/commit/d21622d34063a0d0f88ff5fadcc335ac897e926f))
* override browser autofill background styles for better UI consistency ([999ca5a](https://github.com/jordanlambrecht/tracker-tracker/commit/999ca5ab9326cdb40ba7a6a1c1ae74ae932ed626))
* reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
* sanitize error message in backup restore response ([b0fabc6](https://github.com/jordanlambrecht/tracker-tracker/commit/b0fabc62bfaa3ed90d82cdd0ac0c6e8f36a12f5d))
* sec audit checks catch block for ignore comments ([#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45)) ([1504166](https://github.com/jordanlambrecht/tracker-tracker/commit/1504166aa22db59f4de7b400ce2e22d93088f33f))
* security audit now checks catch block body for ignore comments. Closes [#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45) ([19f1cb7](https://github.com/jordanlambrecht/tracker-tracker/commit/19f1cb74258f923b1960b01de40c800ada840e8e))
* suppress 1Password autofill on non-login password fields ([c987318](https://github.com/jordanlambrecht/tracker-tracker/commit/c987318b2b1ae3d87a9d7a9de339d574f8a08240))
* update gazelleAuthStyle to use token ([96ca1f7](https://github.com/jordanlambrecht/tracker-tracker/commit/96ca1f78e31dcd6cb922fef39b8ce9824c806129))
* update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))
* update PUBLIC_PREFIX to include additional paths for image loading ([8d8709a](https://github.com/jordanlambrecht/tracker-tracker/commit/8d8709acfb5c5e8c50baf90b9ef7fb6b562b2b1e))
* validate and trim inputs on tracker test and create routes ([0c9e27f](https://github.com/jordanlambrecht/tracker-tracker/commit/0c9e27f487d707da9ddcfd9c5f912bc7cbb47cf5))


### Refactoring

* replace auto-wipe with configurable account lockout ([1bab0c5](https://github.com/jordanlambrecht/tracker-tracker/commit/1bab0c5086cdd74c4bb8a1eea93adaf6ce4e0845))

## [1.11.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.11.0) (2026-03-16)


### Features

* add logging for login, logout, and TOTP verification events ([4bce6da](https://github.com/jordanlambrecht/tracker-tracker/commit/4bce6da45face537047df79d394686af49398360))
* enhance api error handling for multiple adapters ([1891cef](https://github.com/jordanlambrecht/tracker-tracker/commit/1891cef6735e7ef0cf28bed1448a1ba0f35fb0da))
* ip ban check for tracker api calls ([39e9554](https://github.com/jordanlambrecht/tracker-tracker/commit/39e95548f89689b17eb0308255c9d1c204ac3254))
* log auth events for login, TOTP, and logout ([de3c0ce](https://github.com/jordanlambrecht/tracker-tracker/commit/de3c0cec82bc5d05444fb3e3a804c4cc1878e2ba))
* show last seen and error state on download client cards ([#35](https://github.com/jordanlambrecht/tracker-tracker/issues/35)) ([36c07e6](https://github.com/jordanlambrecht/tracker-tracker/commit/36c07e689fc93fd7f1d9589d0f72bd506102e92c))
* show per-endpoint debug info in tracker debug poll ([f088582](https://github.com/jordanlambrecht/tracker-tracker/commit/f088582119b1a9c0bb4e40c3088ecaf05aa12dbb))
* update UploadPolarChart with html escaping ([9720759](https://github.com/jordanlambrecht/tracker-tracker/commit/972075966b8ab6e3d092c06c725d407857c4fccc))


### Bug Fixes

* add --ignore-scripts option to pnpm prune in Dockerfile ([259ed39](https://github.com/jordanlambrecht/tracker-tracker/commit/259ed39e418080652e410227a227399c2444275c))
* **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
* disable clients with cleared credentials on restore ([14ee232](https://github.com/jordanlambrecht/tracker-tracker/commit/14ee232e1800e6e46ed89f57dcfb4a0e3a4f50a2))
* favicon wasnt showing in production ([d21622d](https://github.com/jordanlambrecht/tracker-tracker/commit/d21622d34063a0d0f88ff5fadcc335ac897e926f))
* override browser autofill background styles for better UI consistency ([999ca5a](https://github.com/jordanlambrecht/tracker-tracker/commit/999ca5ab9326cdb40ba7a6a1c1ae74ae932ed626))
* reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
* sanitize error message in backup restore response ([b0fabc6](https://github.com/jordanlambrecht/tracker-tracker/commit/b0fabc62bfaa3ed90d82cdd0ac0c6e8f36a12f5d))
* sec audit checks catch block for ignore comments ([#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45)) ([1504166](https://github.com/jordanlambrecht/tracker-tracker/commit/1504166aa22db59f4de7b400ce2e22d93088f33f))
* security audit now checks catch block body for ignore comments. Closes [#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45) ([19f1cb7](https://github.com/jordanlambrecht/tracker-tracker/commit/19f1cb74258f923b1960b01de40c800ada840e8e))
* suppress 1Password autofill on non-login password fields ([c987318](https://github.com/jordanlambrecht/tracker-tracker/commit/c987318b2b1ae3d87a9d7a9de339d574f8a08240))
* update gazelleAuthStyle to use token ([96ca1f7](https://github.com/jordanlambrecht/tracker-tracker/commit/96ca1f78e31dcd6cb922fef39b8ce9824c806129))
* update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))
* update PUBLIC_PREFIX to include additional paths for image loading ([8d8709a](https://github.com/jordanlambrecht/tracker-tracker/commit/8d8709acfb5c5e8c50baf90b9ef7fb6b562b2b1e))
* validate and trim inputs on tracker test and create routes ([0c9e27f](https://github.com/jordanlambrecht/tracker-tracker/commit/0c9e27f487d707da9ddcfd9c5f912bc7cbb47cf5))


### Refactoring

* replace auto-wipe with configurable account lockout ([1bab0c5](https://github.com/jordanlambrecht/tracker-tracker/commit/1bab0c5086cdd74c4bb8a1eea93adaf6ce4e0845))

## [1.10.4](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.10.4) (2026-03-16)

### Features

- add logging for login, logout, and TOTP verification events ([4bce6da](https://github.com/jordanlambrecht/tracker-tracker/commit/4bce6da45face537047df79d394686af49398360))

### Bug Fixes

- add --ignore-scripts option to pnpm prune in Dockerfile ([259ed39](https://github.com/jordanlambrecht/tracker-tracker/commit/259ed39e418080652e410227a227399c2444275c))
- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))
- update PUBLIC_PREFIX to include additional paths for image loading ([8d8709a](https://github.com/jordanlambrecht/tracker-tracker/commit/8d8709acfb5c5e8c50baf90b9ef7fb6b562b2b1e))

## [1.10.3](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.10.3) (2026-03-16)

### Bug Fixes

- add --ignore-scripts option to pnpm prune in Dockerfile ([259ed39](https://github.com/jordanlambrecht/tracker-tracker/commit/259ed39e418080652e410227a227399c2444275c))
- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))

## [1.10.2](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.10.2) (2026-03-16)

### Bug Fixes

- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))

## [1.10.1](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.10.1) (2026-03-16)

### Features

- add area and totals modes to daily volume chart ([8c6636c](https://github.com/jordanlambrecht/tracker-tracker/commit/8c6636c3f0b0f99c6e88e47bba1f56aa92bb9983))
- add cross-seed network, size scatter, and category breakdown to fleet dashboard ([7e6bd67](https://github.com/jordanlambrecht/tracker-tracker/commit/7e6bd67998b14e4c221a9b1a50f120631b22c847))
- add sankey flow and parallel views to distribution chart ([58e2d7c](https://github.com/jordanlambrecht/tracker-tracker/commit/58e2d7c218dbb29743a94e0ea68954e752bede23))
- add stacked and total view modes to comparison charts ([cdf0f73](https://github.com/jordanlambrecht/tracker-tracker/commit/cdf0f732a82c675c07fcdd21c334603bce937298))
- add volume heatmap and calendar charts ([7848e89](https://github.com/jordanlambrecht/tracker-tracker/commit/7848e89ca8462afcb1fcc5808c817b5c0533d91d))
- added logo to footer ([1270099](https://github.com/jordanlambrecht/tracker-tracker/commit/1270099c6ad49de2d09b0f6c768789b457e7c521))
- added timestamp to dl client disconnect error ([0cfabe2](https://github.com/jordanlambrecht/tracker-tracker/commit/0cfabe26f4740ca8dd9e9cbef3c3e3b15be5818d))
- auto-fill proxy port based on selected type in ProxySection ([0e2f30e](https://github.com/jordanlambrecht/tracker-tracker/commit/0e2f30efdfbe544924cb2d2b9c16282acc6e70ac))
- encrypt scheduled and manual backups with stored password ([e514f9c](https://github.com/jordanlambrecht/tracker-tracker/commit/e514f9c5f8771690eb3ed6f623bf6881ab653a9e))

### Bug Fixes

- add .trivyignore file with CVE entries for vulnerability scanning ([e78d5e9](https://github.com/jordanlambrecht/tracker-tracker/commit/e78d5e9939f81349e2e82f5caa89510f850f0bc7))
- add missing alias for typography in vitest configuration ([e7a7e34](https://github.com/jordanlambrecht/tracker-tracker/commit/e7a7e3498f199b1e3d99e6dd211183d486379a9e))
- add missing permissions for actions in CodeQL workflow ([c1210df](https://github.com/jordanlambrecht/tracker-tracker/commit/c1210df290cccff1c7f333c6ee5df0cbb4d0e35e))
- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- commit-msg hook ([e8c81d1](https://github.com/jordanlambrecht/tracker-tracker/commit/e8c81d1cbbb077c2e3e385270d83f2443740b819))
- construct DATABASE_URL from POSTGRES env vars when not set ([c8c473a](https://github.com/jordanlambrecht/tracker-tracker/commit/c8c473a718bd47c50498a744c5b9c49572d38579))
- re-encrypt backup password on password change, clear on lockdown ([cf7a3dc](https://github.com/jordanlambrecht/tracker-tracker/commit/cf7a3dca1e242501cbafde491e9f8654e7e8e78f))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- remove redundant comment ([18688d5](https://github.com/jordanlambrecht/tracker-tracker/commit/18688d5f1dc4cc1f7c78bb4825b1e9892a344dbf))
- update .trivyignore with additional CVE entries ([88142b5](https://github.com/jordanlambrecht/tracker-tracker/commit/88142b5ad8a6cfe819b1611aa8760454b20ef7aa))
- update tracker file detection method and enhance session secret length ([5a23ccd](https://github.com/jordanlambrecht/tracker-tracker/commit/5a23ccdcade32f17fbd4a9d495ee65bce9e2df24))
- update Trivy to version 0.35.0 in CI and release workflows ([88877f4](https://github.com/jordanlambrecht/tracker-tracker/commit/88877f4cace97937a50d07218333f7b19b0d9b1e))

### Performance

- batch snapshot queries and eliminate redundant DB round-trip ([ec4f77b](https://github.com/jordanlambrecht/tracker-tracker/commit/ec4f77b9eb7d813e88304ade53faad01b731a00d))

### Refactoring

- consolidate chart utilities and wire into 25+ chart files ([426b017](https://github.com/jordanlambrecht/tracker-tracker/commit/426b01747095147cc970708b57cff61a4871a95e))
- extract shared server helpers and wire into consumers ([07c80d4](https://github.com/jordanlambrecht/tracker-tracker/commit/07c80d4e59863d0d15310841e57a3f558316b47d))
- merge TopTorrentsTable and ElderTorrentsTable into TorrentRankingTable ([003b01c](https://github.com/jordanlambrecht/tracker-tracker/commit/003b01ce9a002c30e0e1e5b91b61804656503023))
- streamline request creation in tracker routes tests ([13a42f7](https://github.com/jordanlambrecht/tracker-tracker/commit/13a42f793dd128f8d523ddebfa6953830dff09cb))

## [1.10.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.8.4...v1.10.0) (2026-03-16)

### Features

- add area and totals modes to daily volume chart ([8c6636c](https://github.com/jordanlambrecht/tracker-tracker/commit/8c6636c3f0b0f99c6e88e47bba1f56aa92bb9983))
- add cross-seed network, size scatter, and category breakdown to fleet dashboard ([7e6bd67](https://github.com/jordanlambrecht/tracker-tracker/commit/7e6bd67998b14e4c221a9b1a50f120631b22c847))
- add sankey flow and parallel views to distribution chart ([58e2d7c](https://github.com/jordanlambrecht/tracker-tracker/commit/58e2d7c218dbb29743a94e0ea68954e752bede23))
- add stacked and total view modes to comparison charts ([cdf0f73](https://github.com/jordanlambrecht/tracker-tracker/commit/cdf0f732a82c675c07fcdd21c334603bce937298))
- add volume heatmap and calendar charts ([7848e89](https://github.com/jordanlambrecht/tracker-tracker/commit/7848e89ca8462afcb1fcc5808c817b5c0533d91d))
- added logo to footer ([1270099](https://github.com/jordanlambrecht/tracker-tracker/commit/1270099c6ad49de2d09b0f6c768789b457e7c521))
- added timestamp to dl client disconnect error ([0cfabe2](https://github.com/jordanlambrecht/tracker-tracker/commit/0cfabe26f4740ca8dd9e9cbef3c3e3b15be5818d))
- auto-fill proxy port based on selected type in ProxySection ([0e2f30e](https://github.com/jordanlambrecht/tracker-tracker/commit/0e2f30efdfbe544924cb2d2b9c16282acc6e70ac))
- encrypt scheduled and manual backups with stored password ([e514f9c](https://github.com/jordanlambrecht/tracker-tracker/commit/e514f9c5f8771690eb3ed6f623bf6881ab653a9e))

### Bug Fixes

- add .trivyignore file with CVE entries for vulnerability scanning ([e78d5e9](https://github.com/jordanlambrecht/tracker-tracker/commit/e78d5e9939f81349e2e82f5caa89510f850f0bc7))
- add missing alias for typography in vitest configuration ([e7a7e34](https://github.com/jordanlambrecht/tracker-tracker/commit/e7a7e3498f199b1e3d99e6dd211183d486379a9e))
- add missing permissions for actions in CodeQL workflow ([c1210df](https://github.com/jordanlambrecht/tracker-tracker/commit/c1210df290cccff1c7f333c6ee5df0cbb4d0e35e))
- commit-msg hook ([e8c81d1](https://github.com/jordanlambrecht/tracker-tracker/commit/e8c81d1cbbb077c2e3e385270d83f2443740b819))
- construct DATABASE_URL from POSTGRES env vars when not set ([c8c473a](https://github.com/jordanlambrecht/tracker-tracker/commit/c8c473a718bd47c50498a744c5b9c49572d38579))
- re-encrypt backup password on password change, clear on lockdown ([cf7a3dc](https://github.com/jordanlambrecht/tracker-tracker/commit/cf7a3dca1e242501cbafde491e9f8654e7e8e78f))
- remove redundant comment ([18688d5](https://github.com/jordanlambrecht/tracker-tracker/commit/18688d5f1dc4cc1f7c78bb4825b1e9892a344dbf))
- update .trivyignore with additional CVE entries ([88142b5](https://github.com/jordanlambrecht/tracker-tracker/commit/88142b5ad8a6cfe819b1611aa8760454b20ef7aa))
- update tracker file detection method and enhance session secret length ([5a23ccd](https://github.com/jordanlambrecht/tracker-tracker/commit/5a23ccdcade32f17fbd4a9d495ee65bce9e2df24))
- update Trivy to version 0.35.0 in CI and release workflows ([88877f4](https://github.com/jordanlambrecht/tracker-tracker/commit/88877f4cace97937a50d07218333f7b19b0d9b1e))

### Performance

- batch snapshot queries and eliminate redundant DB round-trip ([ec4f77b](https://github.com/jordanlambrecht/tracker-tracker/commit/ec4f77b9eb7d813e88304ade53faad01b731a00d))

### Refactoring

- consolidate chart utilities and wire into 25+ chart files ([426b017](https://github.com/jordanlambrecht/tracker-tracker/commit/426b01747095147cc970708b57cff61a4871a95e))
- extract shared server helpers and wire into consumers ([07c80d4](https://github.com/jordanlambrecht/tracker-tracker/commit/07c80d4e59863d0d15310841e57a3f558316b47d))
- merge TopTorrentsTable and ElderTorrentsTable into TorrentRankingTable ([003b01c](https://github.com/jordanlambrecht/tracker-tracker/commit/003b01ce9a002c30e0e1e5b91b61804656503023))
- streamline request creation in tracker routes tests ([13a42f7](https://github.com/jordanlambrecht/tracker-tracker/commit/13a42f793dd128f8d523ddebfa6953830dff09cb))

## [1.9.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.8.4...v1.9.0) (2026-03-16)

### Features

- add area and totals modes to daily volume chart ([8c6636c](https://github.com/jordanlambrecht/tracker-tracker/commit/8c6636c3f0b0f99c6e88e47bba1f56aa92bb9983))
- add cross-seed network, size scatter, and category breakdown to fleet dashboard ([7e6bd67](https://github.com/jordanlambrecht/tracker-tracker/commit/7e6bd67998b14e4c221a9b1a50f120631b22c847))
- add sankey flow and parallel views to distribution chart ([58e2d7c](https://github.com/jordanlambrecht/tracker-tracker/commit/58e2d7c218dbb29743a94e0ea68954e752bede23))
- add stacked and total view modes to comparison charts ([cdf0f73](https://github.com/jordanlambrecht/tracker-tracker/commit/cdf0f732a82c675c07fcdd21c334603bce937298))
- add volume heatmap and calendar charts ([7848e89](https://github.com/jordanlambrecht/tracker-tracker/commit/7848e89ca8462afcb1fcc5808c817b5c0533d91d))
- added timestamp to dl client disconnect error ([0cfabe2](https://github.com/jordanlambrecht/tracker-tracker/commit/0cfabe26f4740ca8dd9e9cbef3c3e3b15be5818d))

### Bug Fixes

- add missing alias for typography in vitest configuration ([e7a7e34](https://github.com/jordanlambrecht/tracker-tracker/commit/e7a7e3498f199b1e3d99e6dd211183d486379a9e))
- commit-msg hook ([e8c81d1](https://github.com/jordanlambrecht/tracker-tracker/commit/e8c81d1cbbb077c2e3e385270d83f2443740b819))
- construct DATABASE_URL from POSTGRES env vars when not set ([c8c473a](https://github.com/jordanlambrecht/tracker-tracker/commit/c8c473a718bd47c50498a744c5b9c49572d38579))
- remove redundant comment ([18688d5](https://github.com/jordanlambrecht/tracker-tracker/commit/18688d5f1dc4cc1f7c78bb4825b1e9892a344dbf))

### Performance

- batch snapshot queries and eliminate redundant DB round-trip ([ec4f77b](https://github.com/jordanlambrecht/tracker-tracker/commit/ec4f77b9eb7d813e88304ade53faad01b731a00d))

### Refactoring

- consolidate chart utilities and wire into 25+ chart files ([426b017](https://github.com/jordanlambrecht/tracker-tracker/commit/426b01747095147cc970708b57cff61a4871a95e))
- extract shared server helpers and wire into consumers ([07c80d4](https://github.com/jordanlambrecht/tracker-tracker/commit/07c80d4e59863d0d15310841e57a3f558316b47d))
- merge TopTorrentsTable and ElderTorrentsTable into TorrentRankingTable ([003b01c](https://github.com/jordanlambrecht/tracker-tracker/commit/003b01ce9a002c30e0e1e5b91b61804656503023))
- streamline request creation in tracker routes tests ([13a42f7](https://github.com/jordanlambrecht/tracker-tracker/commit/13a42f793dd128f8d523ddebfa6953830dff09cb))

## [1.8.5](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.8.4...v1.8.5) (2026-03-15)

### Bug Fixes

- remove redundant comment ([18688d5](https://github.com/jordanlambrecht/tracker-tracker/commit/18688d5f1dc4cc1f7c78bb4825b1e9892a344dbf))

## [1.8.4](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.8.3...v1.8.4) (2026-03-15)

### Features

- Cached torrent fallback: stores last successful torrent list per tag, serves cached data when qBittorrent is unreachable, with stale data banner indicating cache age
- Anniversary milestone detection with dashboard alerts for tracker join date anniversaries
- Login timer dashboard setting (showLoginTimers) with shared state toggle
- Last access date field and enhanced community data in tracker adapters
- Bento grid slot system with explicit-positioning layout algorithms for tracker detail stat cards
- Responsive bento grid: 2-col (mobile), 3-col (md), and 3-or-4-col (lg) breakpoints with per-breakpoint layout algorithms
- Stat card alert system: danger glow, outline, and tooltip icon for ratio below required and negative buffer
- Daily buffer candlestick chart on tracker detail pages
- Dashboard alerts "Clear All" button for batch dismissal
- Login timer cards link to tracker site with hover external-link indicator
- Rank timeline: promotion/demotion chevrons (green/red), anniversary milestones, horizontal scroll
- Swipe/drag gestures on sidebar client carousel (pointer events with capture)
- 4 new draft trackers: AsianCinema, Bibliotik, UHDBits, Seed Pool
- TrackerHub slugs and status page URLs populated across 19 existing trackers
- Download client uptime tracking: 24h heartbeat history displayed as a horizontal status bar in each client's settings card, with 5-minute bucket granularity and long-term retention for future chart overlays
- Live active torrents: 5-second polling of actively transferring torrents on tracker detail page with live speed/state updates
- Per-client stat card breakdowns: Seeding and Total Size cards show per-client rows when multiple download clients are configured (stacked variant with sumIsHero)
- H&R risk separated from unsatisfied: stat card shows only stopped/paused unsatisfied torrents as actual risk, tooltip shows total unsatisfied count
- Required ratio fallback: stat card falls back to tracker registry minimumRatio when the tracker API doesn't provide requiredRatio (UNIT3D)
- Aggregate upload/download speeds shown inline in Active Uploads/Downloads section headers
- Untagged torrents now shown in tag group breakdown charts (donut, bar, treemap) when "Count Not Tagged" is enabled

### Security

- Strip announce URL passkeys from torrent responses at both cache-write time and API response time
- Sanitize raw error messages in client scheduler — generic messages to client, raw errors to server logs only

### Changed

- StatCard expanded with stacked and ring variants for bento grid layouts
- Tracker detail cards migrated to slot-based grid system with slot registry
- LoginTimers custom ring replaced with StatCard type=ring
- formatTimeAgo extracted to shared formatters module
- formatBytesNum improved with negative value handling and variable precision
- CoreStatCards refactored: buildCoreStatDescriptors extracted as pure data function, component wrapper removed
- Slot rendering consolidated: renderSlotElement single source in slot-registry, replaces duplicate SLOT_COMPONENT_MAP lookups
- loginDeadlineSlot promoted to span:2 with priority 30 (stacked data cards get triple promotion over compact ring)
- gazelleCommentsSlot guarded against NaN from missing API fields
- Explicit draft: true/false required on all tracker registry entries (enforced by test)
- Import order standardized across codebase
- Shared portal-based Tooltip component replaces all native title attributes and inline tooltip implementations across 15 files
- Backup settings restructured: Export, Restore, and Configuration split into separate sections
- "Encrypt backups" renamed to "Password-protect backups" for clarity
- Backup password field moved from Configuration to Export section (ephemeral per-export, not a saved setting)
- Storage path input visible outside scheduled backup toggle (used by both manual exports and scheduled backups)
- Backup Now saves to disk silently when storage path is available; browser download only as fallback
- Changelog dialog renders markdown instead of raw text
- Changelog version header auto-updates on release via pnpm version lifecycle hook
- Deep poll optimized: parallel per-tag torrent fetching replaces single unfiltered dump (20MB → 10MB, 33% faster), public torrents filtered out before processing
- Heartbeat interval reduced from 10s to 5s for more responsive speed data
- Deep poll minimum raised from 10s to 60s, default from 30s to 300s (full torrent dump is ~20MB)
- Download client settings: explicit Save/Discard buttons replace auto-save on every keystroke
- Client snapshot retention now uses configurable snapshotRetentionDays instead of hardcoded 30 days
- Fleet snapshots API max query window raised from 30 to 365 days
- Icons: seeding changed from anchor to seedling, seedbonus changed from star to gem, required ratio uses balance scale (distinct from ratio arrows and favorite star)
- StatCard shadow reduced from nm-raised to nm-raised-sm to prevent neighbor shadow bleed in grids
- Card component no longer applies overflow-hidden by default (was clipping neumorphic shadows on nested cards)
- ChartCard uses p-6/-m-6 breathing room for nested neumorphic shadows with documentation in globals.css
- Ecosystem stats (Total Uploaded/Downloaded/Buffer) now use unit prop for smaller unit text
- Unsatisfied torrents table: scrollable when >15 rows, percentage-based column widths, MarqueeText for long names
- Top Seeded and Elder Torrents tables: percentage-based column widths with edge padding
- Table component: overscroll-contain prevents elastic bounce on scrollable tables, empty state vertically centered
- Leeching and Upload Speed stat cards removed from Torrents tab (redundant with Active Downloads table and inline speed display)

### Fixed

- Chart spacing on tracker detail pages: reduced top margin from 78px to 16-40px (was designed for multi-tracker dashboard legends)
- Double/triple slot index mapping collision when algorithm promotes doubles to triples
- Sidebar duplicate filepath comment removed
- Color hex code validation bug
- Backup storage path validated on filesystem (mkdir + access check) when saving settings
- Backup Now disabled when configuration has unsaved changes
- Default storage path (/data/backups) shown in input instead of empty placeholder
- Export error messages now visible in Export section (were orphaned after section split)
- Hydration mismatch on tracker detail page: added loading.tsx for framework-level Suspense boundary
- Cross-seed donut chart vertically centered in card when adjacent Categories card is taller
- Tag group breakdown charts (donut/bar/treemap) now include "Untagged" slice when countUnmatched is enabled (previously only worked in numbers view)
- Uptime accumulator cleanup on client delete prevents FK violation on flush
- Backup restore uses onConflictDoNothing for uptime buckets to handle edge-case duplicates
- Active torrents poll correctly transitions state from "uploading"/"downloading" to stalled when torrent drops from active list
- POST /api/clients default pollIntervalSeconds fixed from 30 to 300 (was below the validated minimum of 60)

## v1.6.0 — Settings & Debug

### Features

- Debug button that shows raw API response output for tracker polling
- Settings page decomposed into section components

## v1.5.0 — Security & Backup Hardening

### Features

- Re-encryption for backup restore: tokens re-encrypted from backup salt to current salt via reencryptField()
- Progressive login throttling: escalating lockout delays (5 req → 30s, 10 → 2m, 15 → 15m, 20 → 1h) with 429 responses
- SSRF protection: isUnsafeNetworkHost blocks private/loopback/link-local addresses in tracker URLs

### Changed

- Extracted DB-aware privacy operations (createPrivacyMask, scrubSnapshotUsernames) into new privacy-db.ts module to eliminate duplication across 4 route handlers
- Added shared reencrypt() function in crypto.ts, used by change-password and backup-restore routes

### Fixed

- Critical SQL column mapping bug in scrubSnapshotUsernames: "group" → group_name (Drizzle schema field mapping)
- UTF-8 consistency in scrubSnapshotUsernames: LENGTH → CHAR_LENGTH
- Missing transaction error handling in change-password route (would crash with opaque 500)
- Master password now validated before parsing backup payload

## v1.4.0 — Docker & Deployment

### Changed

- Simplified backup process by removing encryption for automated backups
- Dockerfile optimized for drizzle-kit schema sync (dedicated build stage, bash in runner)
- Docker entrypoint improved for schema sync process
- PostgreSQL image updated to 17-alpine

### Fixed

- Proxy configuration updated to include tracker logo path
- Drizzle config dotenv handling improved

## v1.3.0 — Chart & Detail Overhaul

### Features

- Chart legend system overhaul: scroll pagination replaced with natural wrapping, adjustable spacing, and an All/None toggle button on multi-series charts
- Log scale toggle added to 6 dashboard charts (Buffer, Seedbonus, Active Torrents, Total Uploaded, Ratio Stability, Buffer Velocity) with auto-detect when data spans >100x range
- Tracker detail page redesign: TrackerHub status card with animated collapse, user ranks table with perk pills, release/notable/banned group badges, elder torrents table with rank column and marquee ticker
- Torrents tab: compact table mode, category acquisition chart, 3D torrent age scatter plot, dead torrents card, average seed time stat card and cohort chart, full-width unsatisfied progress bars
- Ratio chart: red dashed baseline at minimum required ratio
- StatCard tooltip support with hover popup
- Sidebar: archived tracker styling (dimmed, static dot, "Archived" label) and GitHub repo link
- New logo

### Refactoring

- Tracker detail page slimmed from 1,229 to 265 lines — extracted TrackerDetailHeader, UserProfileCard, AnalyticsTab, TrackerInfoTab, CoreStatCards, PollLog, platform-specific guard components, and independent data-fetching hooks with AbortControllers
- Dashboard page split into AnalyticsSection and EcosystemStatsSection components
- Chart preference hooks consolidated into shared `useChartPreferencesBase`
- StatCard value/unit prop split for consistent formatting

### Fixes

- Log(0) crash in ComparisonChart when switching to log scale with zero-value data points
- VolumeSurface3D (Upload Landscape) background now matches card surface instead of broken WebGL transparent
- Tracker GET endpoint hardened with column projection (excludes avatarData, encrypted tokens from response)
- computeDelta BigInt null guard prevents crash on missing snapshot data
- StrictMode abort race condition: loading state only clears when the active request completes
- Emoji picker overflow in tag group settings
- Proxy toggle disabled when no proxy is configured
- Join date input capped to today in both UI and API validation
- Redirect to dashboard after archiving a tracker
- Design system alignment: raw `<p>` elements replaced with `<H2>` component across dashboard sections
- Archived trackers no longer appear on the dashboard
- Normalized content categories: "Software" → "Apps", "Sport" → "Sports", "Animation" → "TV"
- Tracker registry test allows `loginIntervalDays: 0` to mean "no login interval policy"

## v0.1.0 — Initial Release

- Dashboard with aggregate stats, comparison charts, and tracker leaderboard
- Tracker detail pages with upload/download history, ratio, buffer, seedbonus, and seeding charts
- UNIT3D platform adapter with encrypted API token storage
- Master password auth with Argon2 hash + AES-256-GCM encryption
- Global polling interval (15 min – 24 hours) with unified batch timestamps
- Dark neumorphic UI with per-tracker accent colors
- Sidebar with drag-and-drop reorder, stat modes, and sort options
- Tracker registry with detailed data for Aither, Blutopia, FearNoPeer, OnlyEncodes, and Upload.cx
- TrackerHub integration for site status monitoring
- Rank progression timeline and rank change alerts
- Privacy mode with username/group redaction
- App-wide settings (privacy toggle, data scrub)
- Poll log with collapsible history per tracker
