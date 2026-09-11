import { exampleById } from './model/examples.ts'
import type { Plan } from './model/types.ts'

/**
 * Plan shapes the worked examples do not contain.
 *
 * A fixture, not part of the library: nothing in `index.ts` imports it, so it
 * never reaches a bundle. It lives here rather than beside one test because
 * more than one thing needs to sweep over the same shapes, and two lists of
 * them would drift.
 *
 * The three examples exercise twenty six of the sixty five rules, so for the
 * other thirty nine nothing had ever read the sentence they produce. Two of
 * those sentences turned out to be refused by this program's own guard, which
 * is the one thing the checks below exist to make impossible, and three
 * disagreed with their own numbers.
 *
 * Between these and the examples every rule fires at least once, which is what
 * `every rule has had its sentence read` asserts. Each mutation is the smallest
 * change that makes a family of rules speak, and several exist only because a
 * rule declined to fire for a reason worth knowing: R004 skips anybody who
 * could already spend, so its shape needs a passphrase to be the thing
 * stopping them, and L005 only speaks when the group is worse than its
 * members, so its shape needs the descriptor kept outside the group.
 */
export const SHAPE_MUTATIONS: [string, (plan: Plan) => void][] = [
  [
    'memorised passphrases',
    (p) => {
      p.keys.forEach((k) => {
        k.passphrase = {
          enabled: true,
          storage: 'memorized',
          locationIds: [],
          splitThreshold: null,
          knownBy: [],
        }
      })
    },
  ],
  [
    'passphrase beside the seed',
    (p) => {
      p.keys.forEach((k) => {
        k.passphrase = {
          enabled: true,
          storage: 'written',
          locationIds: ['loc_home'],
          splitThreshold: null,
          knownBy: [],
        }
      })
    },
  ],
  [
    'key with nothing',
    (p) => {
      if (!p.keys[0]) return
      p.keys[0].deviceId = null
      p.keys[0].backups = []
    },
  ],
  [
    'one place',
    (p) => {
      if (!p.locations[0]) return
      p.locations = [p.locations[0]]
    },
  ],
  [
    'nobody',
    (p) => {
      p.people = []
      p.locations.forEach((l) => {
        l.access = []
        l.custodianId = null
      })
    },
  ],
  [
    'every concern',
    (p) => {
      p.profile.concerns = [
        'loss',
        'theft',
        'fire-flood',
        'death',
        'incapacity',
        'coercion',
        'insider',
        'supply-chain',
        'legal-seizure',
      ]
    },
  ],
  [
    'paper century',
    (p) => {
      p.profile.horizonYears = 100
      p.keys.forEach((k) =>
        k.backups.forEach((b) => {
          b.medium = 'paper'
        })
      )
    },
  ],
  [
    'plain digital',
    (p) => {
      p.keys.forEach((k) =>
        k.backups.forEach((b) => {
          b.medium = 'plain-digital'
        })
      )
    },
  ],
  [
    'no pin',
    (p) => {
      p.devices.forEach((d) => {
        d.pin = { storage: 'none', locationId: null, knownBy: [] }
      })
    },
  ],
  [
    'pin beside device',
    (p) => {
      p.devices.forEach((d) => {
        d.pin = { storage: 'written', locationId: 'loc_home', knownBy: [] }
      })
    },
  ],
  [
    'on person',
    (p) => {
      if (!p.locations[0]) return
      p.locations[0].kind = 'on-person'
    },
  ],
  [
    'service cosigner',
    (p) => {
      if (!p.devices[0]) return
      p.devices[0].kind = 'service-cosigner'
    },
  ],
  [
    'timelock only',
    (p) => {
      if (!p.wallets[0]?.paths[0]) return
      p.wallets[0].paths = [{ ...p.wallets[0].paths[0], timelockDays: 365 }]
    },
  ],
  [
    'orphan key',
    (p) => {
      p.wallets.forEach((w) =>
        w.paths.forEach((path) => {
          path.keyIds = path.keyIds.filter((k) => k !== 'key_c')
        })
      )
    },
  ],
  [
    'two on one device',
    (p) => {
      if (!p.keys[0] || !p.keys[1]) return
      p.keys[1].deviceId = p.keys[0].deviceId
    },
  ],
  [
    'no way to spend',
    (p) => {
      if (!p.wallets[0]) return
      p.wallets[0].paths = []
    },
  ],
  [
    'threshold above the keys',
    (p) => {
      if (!p.wallets[0]?.paths[0]) return
      p.wallets[0].paths[0].threshold = 9
    },
  ],
  [
    'a path with no keys',
    (p) => {
      if (!p.wallets[0]?.paths[0]) return
      p.wallets[0].paths[0].keyIds = []
    },
  ],
  [
    'no written backup',
    (p) => {
      p.keys.forEach((k) => {
        k.backups = []
      })
    },
  ],
  [
    'nothing has a place',
    (p) => {
      p.keys.forEach((k) => {
        k.deviceLocationId = null
        k.backups.forEach((b) => {
          b.locationId = null
        })
      })
    },
  ],
  [
    'no configuration backup',
    (p) => {
      p.wallets.forEach((w) => {
        w.configBackups = []
      })
    },
  ],
  [
    'split short of its threshold',
    (p) => {
      if (!p.keys[0]?.backups[0]) return
      p.keys[0].backups[0].split = { groupId: 'g1', threshold: 5 }
    },
  ],
  [
    'a hot wallet holding most of it',
    (p) => {
      if (!p.wallets[0]) return
      p.wallets[0].tier = 'hot'
      p.wallets[0].stake = 'large'
    },
  ],
  [
    'a co-signer with no key',
    (p) => {
      p.people.push({
        id: 'per_co',
        label: 'Co-signer 1',
        role: 'cosigner',
        availability: 'days',
        technicalSkill: 'competent',
        knowsPlanExists: true,
        knowsWhereInstructionsAre: true,
        notes: '',
      })
    },
  ],
  [
    'a place with no disaster group',
    (p) => {
      p.locations.forEach((l) => {
        l.disasterGroup = null
      })
    },
  ],
  [
    'one backup is the whole margin',
    (p) => {
      p.keys.forEach((k, i) => {
        if (i > 0) {
          k.deviceId = null
        }
      })
    },
  ],
  [
    'everything in one disaster group',
    (p) => {
      p.locations.forEach((l) => {
        l.disasterGroup = 'Home city'
      })
    },
  ],
  [
    'a tolerance of nothing',
    (p) => {
      p.profile.recoveryToleranceDays = 0
      p.locations.forEach((l) => {
        l.travelMinutes = 600
      })
    },
  ],
  [
    'one person can open everything',
    (p) => {
      p.locations.forEach((l) => {
        l.access = [{ personId: 'per_successor', condition: 'always', delayDays: 0 }]
      })
    },
  ],
  [
    'one architecture',
    (p) => {
      p.devices.forEach((d) => {
        d.architecture = 'One silicon'
      })
    },
  ],
  [
    'one supply route',
    (p) => {
      p.devices.forEach((d) => {
        d.supplyChain = 'second-hand'
      })
    },
  ],
  [
    'a successor who was never told',
    (p) => {
      p.people.forEach((x) => {
        x.knowsPlanExists = false
        x.knowsWhereInstructionsAre = false
      })
    },
  ],
  [
    'losing one backup ends it',
    (p) => {
      p.keys.forEach((k) => {
        k.deviceId = null
        k.deviceLocationId = null
      })
      if (!p.wallets[0]?.paths[0]) return
      p.wallets[0].paths[0].threshold = 3
    },
  ],
  [
    'a quorum in one disaster group',
    (p) => {
      if (p.locations.length < 3) return
      p.locations[0].disasterGroup = 'Home city'
      p.locations[1].disasterGroup = 'Home city'
      p.locations[2].disasterGroup = 'Coast'
      p.keys.forEach((k, i) => {
        k.deviceLocationId = p.locations[i].id
        k.backups.forEach((b) => {
          b.locationId = p.locations[i].id
        })
      })
      // The descriptor outside the group, or losing the group's first site takes
      // the wallet on its own and the group says nothing extra.
      p.wallets.forEach((w) => {
        w.configBackups.forEach((c) => {
          c.locationId = p.locations[2].id
        })
      })
    },
  ],
  [
    'a co-signer who can open enough',
    (p) => {
      p.people.push({
        id: 'per_helper',
        label: 'Co-signer 1',
        role: 'cosigner',
        availability: 'days',
        technicalSkill: 'competent',
        knowsPlanExists: true,
        knowsWhereInstructionsAre: true,
        notes: '',
      })
      p.locations.forEach((l) => {
        l.access = [{ personId: 'per_helper', condition: 'always', delayDays: 0 }]
      })
    },
  ],
  [
    'a co-signer who can reach the backups but not spend',
    (p) => {
      p.people.push({
        id: 'per_helper',
        label: 'Co-signer 1',
        role: 'cosigner',
        availability: 'days',
        technicalSkill: 'competent',
        knowsPlanExists: true,
        knowsWhereInstructionsAre: true,
        notes: '',
      })
      p.locations.forEach((l) => {
        l.access = [{ personId: 'per_helper', condition: 'always', delayDays: 0 }]
      })
      // A passphrase they do not have is the something else stopping them.
      p.keys.forEach((k) => {
        k.passphrase = {
          enabled: true,
          storage: 'memorized',
          locationIds: [],
          splitThreshold: null,
          knownBy: [],
        }
      })
    },
  ],
  [
    'material that travels',
    (p) => {
      p.profile.travelsFrequently = true
      if (!p.locations[0]) return
      p.locations[0].kind = 'on-person'
    },
  ],
  [
    'a successor nobody has confirmed',
    (p) => {
      p.people.forEach((x) => {
        x.availability = 'unknown'
      })
    },
  ],
  [
    // Collaborative custody: a company holds one key of the quorum. What
    // stands behind that key is theirs, so the rules about what a key exists
    // as have to stay quiet rather than advise writing it down.
    'a key a company holds',
    (p) => {
      if (!p.keys[2] || !p.people[0]) return
      p.people[0] = { ...p.people[0], role: 'key-agent' }
      p.keys[2] = {
        ...p.keys[2],
        heldBy: p.people[0].id,
        deviceId: null,
        deviceLocationId: null,
        backups: [],
      }
    },
  ],
]

function base(): Plan {
  return structuredClone(exampleById('two-of-three')!)
}

export function shapes(): [string, Plan][] {
  return SHAPE_MUTATIONS.map(([name, mutate]) => {
    const plan = base()
    mutate(plan)
    return [name, plan]
  })
}

/**
 * Every pair of shapes, applied to one plan.
 *
 * Nothing goes wrong one thing at a time, and a sentence that only exists when
 * two conditions hold is a sentence nothing had read. Seven hundred of these
 * take two seconds, which is cheap for the class of defect it covers.
 */
export function shapePairs(): [string, Plan][] {
  const pairs: [string, Plan][] = []
  for (let first = 0; first < SHAPE_MUTATIONS.length; first += 1) {
    for (let second = first + 1; second < SHAPE_MUTATIONS.length; second += 1) {
      const plan = base()
      SHAPE_MUTATIONS[first][1](plan)
      SHAPE_MUTATIONS[second][1](plan)
      pairs.push([`${SHAPE_MUTATIONS[first][0]} and ${SHAPE_MUTATIONS[second][0]}`, plan])
    }
  }
  return pairs
}
