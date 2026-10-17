import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const queuewiseConfig = [...nextVitals, ...nextTypescript]

export default queuewiseConfig
