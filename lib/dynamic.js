import React from 'react'

let currentChunks = []

export default function dynamicComponent (promise, options = {}) {
  return class DynamicComponent extends React.Component {
    constructor (...args) {
      super(...args)

      this.LoadingComponent = options.loading ? options.loading : () => (<p>loading...</p>)
      this.ssr = options.ssr === false ? options.ssr : true

      this.state = { AsyncComponent: null }
      this.isServer = typeof window === 'undefined'

      if (this.ssr) {
        this.loadComponent()
      }
    }

    loadComponent () {
      promise.then((AsyncComponent) => {
        // Set a readable displayName for the wrapper component
        const asyncCompName = AsyncComponent.displayName || AsyncComponent.name
        if (asyncCompName) {
          DynamicComponent.displayName = `DynamicComponent for ${asyncCompName}`
        }

        if (this.mounted) {
          this.setState({ AsyncComponent })
        } else {
          if (this.isServer) {
            currentChunks.push(AsyncComponent.__webpackChunkName)
          }
          this.state.AsyncComponent = AsyncComponent
        }
      })
    }

    componentDidMount () {
      this.mounted = true
      if (!this.ssr) {
        this.loadComponent()
      }
    }

    render () {
      const { AsyncComponent } = this.state
      const { LoadingComponent } = this
      if (!AsyncComponent) return (<LoadingComponent {...this.props} />)

      return <AsyncComponent {...this.props} />
    }
  }
}

export function flushChunks () {
  const chunks = currentChunks
  currentChunks = []
  return chunks
}

export class SameLoopPromise {
  constructor (cb) {
    this.onResultCallbacks = []
    this.onErrorCallbacks = []
    this.cb = cb
  }

  setResult (result) {
    this.gotResult = true
    this.result = result
    this.onResultCallbacks.forEach((cb) => cb(result))
    this.onResultCallbacks = []
  }

  setError (error) {
    this.gotError = true
    this.error = error
    this.onErrorCallbacks.forEach((cb) => cb(error))
    this.onErrorCallbacks = []
  }

  then (onResult, onError) {
    this.runIfNeeded()
    const promise = new SameLoopPromise()

    const handleError = () => {
      if (onError) {
        promise.setResult(onError(this.error))
      } else {
        promise.setError(this.error)
      }
    }

    const handleResult = () => {
      promise.setResult(onResult(this.result))
    }

    if (this.gotResult) {
      handleResult()
      return promise
    }

    if (this.gotError) {
      handleError()
      return promise
    }

    this.onResultCallbacks.push(handleResult)
    this.onErrorCallbacks.push(handleError)

    return promise
  }

  catch (onError) {
    this.runIfNeeded()
    const promise = new SameLoopPromise()

    const handleError = () => {
      promise.setResult(onError(this.error))
    }

    const handleResult = () => {
      promise.setResult(this.result)
    }

    if (this.gotResult) {
      handleResult()
      return promise
    }

    if (this.gotError) {
      handleError()
      return promise
    }

    this.onErrorCallbacks.push(handleError)
    this.onResultCallbacks.push(handleResult)

    return promise
  }

  runIfNeeded () {
    if (!this.cb) return
    if (this.ran) return

    this.ran = true
    this.cb(
      (result) => this.setResult(result),
      (error) => this.setError(error)
    )
  }
}
