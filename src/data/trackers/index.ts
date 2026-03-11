// src/data/trackers/index.ts
//
// Barrel file — assembles individual tracker definitions into the registry array.
// To add a new tracker: create a new file in this directory and add it to the array below.
// Draft trackers (draft: true) are included here but filtered out by TRACKER_REGISTRY.

import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { abtorrents } from "./abtorrents"
import { aither } from "./aither"
import { alpharatio } from "./alpharatio"
import { animebytes } from "./animebytes"
import { anthelion } from "./anthelion"
import { avistaz } from "./avistaz"
import { beyondhd } from "./beyondhd"
import { blutopia } from "./blutopia"
import { broadcasthenet } from "./broadcasthenet"
import { cathoderaytube } from "./cathoderaytube"
import { cinemaz } from "./cinemaz"
import { cinemageddon } from "./cinemageddon"
import { concertos } from "./concertos"
import { empornium } from "./empornium"
import { exoticaz } from "./exoticaz"
import { fearnopeer } from "./fearnopeer"
import { filelist } from "./filelist"
import { gazellegames } from "./gazellegames"
import { greatposterwall } from "./greatposterwall"
import { hawkeuno } from "./hawkeuno"
import { hdbits } from "./hdbits"
import { hdtorrents } from "./hdtorrents"
import { iptorrents } from "./iptorrents"
import { lst } from "./lst"
import { morethantv } from "./morethantv"
import { myanonamouse } from "./myanonamouse"
import { nebulance } from "./nebulance"
import { oldtoons } from "./oldtoons"
import { onlyencodes } from "./onlyencodes"
import { orpheus } from "./orpheus"
import { passthepopcorn } from "./passthepopcorn"
import { pier720 } from "./720pier"
import { privatehd } from "./privatehd"
import { racing4everyone } from "./racing4everyone"
import { redacted } from "./redacted"
import { reelflix } from "./reelflix"
import { secretcinema } from "./secretcinema"
import { skipthecommercials } from "./skipthecommercials"
import { sportscult } from "./sportscult"
import { torrentleech } from "./torrentleech"
import { tvvault } from "./tvvault"
import { uploadcx } from "./uploadcx"

export const ALL_TRACKERS: TrackerRegistryEntry[] = [
  abtorrents,
  aither,
  alpharatio,
  animebytes,
  anthelion,
  avistaz,
  beyondhd,
  blutopia,
  broadcasthenet,
  cathoderaytube,
  cinemaz,
  cinemageddon,
  concertos,
  empornium,
  exoticaz,
  fearnopeer,
  filelist,
  gazellegames,
  greatposterwall,
  hawkeuno,
  hdbits,
  hdtorrents,
  iptorrents,
  lst,
  morethantv,
  myanonamouse,
  nebulance,
  oldtoons,
  onlyencodes,
  orpheus,
  passthepopcorn,
  pier720,
  privatehd,
  racing4everyone,
  redacted,
  reelflix,
  secretcinema,
  skipthecommercials,
  sportscult,
  torrentleech,
  tvvault,
  uploadcx,
]
