import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// The findBy queries wait for the same engine, for the same reason.
configure({ asyncUtilTimeout: 4000 })

// jsdom defines scrollTo and then throws from it, and the app calls it on every
// navigation. Stubbing keeps the output about the tests.
window.scrollTo = () => {}

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = ''
})

afterEach(() => {
  cleanup()
})
