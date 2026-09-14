import React from 'react';

// What-if: any component below this throws during render (a bad API
// response shape, a null field, a third-party script conflict). Without
// this, React 18 unmounts the whole tree and the user sees a blank white
// page with no way forward. This catches that and shows a real message
// with a way to recover instead.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('BulkBatch crashed:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          padding: '32px', fontFamily: 'sans-serif', background: '#0C0913', color: '#F4EFFF',
        }}>
          <h1 style={{ marginBottom: '12px' }}>Something went wrong</h1>
          <p style={{ color: '#B0A4CC', marginBottom: '24px', maxWidth: '440px' }}>
            BulkBatch hit an unexpected error. Your account and data are safe — try reloading the page.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
            style={{
              background: 'linear-gradient(115deg,#FF7A4D,#FF3D8B 40%,#B14DFF 72%,#6A5BFF)',
              color: '#0C0913', fontWeight: 700, border: 'none', borderRadius: '100px',
              padding: '12px 28px', fontSize: '14px', cursor: 'pointer',
            }}
          >
            Reload BulkBatch
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
