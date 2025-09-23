import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock QR Scanner Component
const MockQRScanner = ({ onScan, onError }: { onScan: (result: string) => void, onError: (error: Error) => void }) => {
  const [isScanning, setIsScanning] = React.useState(false)
  const [manualInput, setManualInput] = React.useState('')

  const startScanning = () => {
    setIsScanning(true)
    // Simulate successful scan after 1 second
    setTimeout(() => {
      onScan('TEST-QR-12345')
      setIsScanning(false)
    }, 1000)
  }

  const handleError = () => {
    onError(new Error('Camera access denied'))
    setIsScanning(false)
  }

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScan(manualInput.trim())
      setManualInput('')
    }
  }

  return (
    <div data-testid="qr-scanner">
      {!isScanning ? (
        <>
          <button 
            data-testid="start-scanner" 
            onClick={startScanning}
            aria-label="Start QR Scanner"
          >
            Start Scanner
          </button>
          <button 
            data-testid="simulate-error" 
            onClick={handleError}
            aria-label="Simulate Camera Error"
          >
            Simulate Error
          </button>
          <div data-testid="manual-input-section">
            <input
              data-testid="manual-qr-input"
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleManualSubmit()
                }
              }}
              placeholder="Enter QR code manually"
              aria-label="Manual QR Code Input"
            />
            <button 
              data-testid="manual-submit" 
              onClick={handleManualSubmit}
              aria-label="Submit Manual QR Code"
            >
              Submit
            </button>
          </div>
        </>
      ) : (
        <div data-testid="scanning-indicator">
          <p>Scanning QR Code...</p>
          <div data-testid="scanner-viewport" aria-label="QR Code Scanner Viewport" />
        </div>
      )}
    </div>
  )
}

describe('QR Scanner Component', () => {
  const mockOnScan = jest.fn()
  const mockOnError = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Scanner Interface', () => {
    it('should render scanner controls', () => {
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument()
      expect(screen.getByTestId('start-scanner')).toBeInTheDocument()
      expect(screen.getByTestId('manual-input-section')).toBeInTheDocument()
    })

    it('should show scanning indicator when scanning', async () => {
      const user = userEvent.setup()
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      await user.click(screen.getByTestId('start-scanner'))
      
      expect(screen.getByTestId('scanning-indicator')).toBeInTheDocument()
      expect(screen.getByText('Scanning QR Code...')).toBeInTheDocument()
      expect(screen.getByTestId('scanner-viewport')).toBeInTheDocument()
    })

    it('should have proper accessibility attributes', () => {
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      expect(screen.getByLabelText('Start QR Scanner')).toBeInTheDocument()
      expect(screen.getByLabelText('Manual QR Code Input')).toBeInTheDocument()
      expect(screen.getByLabelText('Submit Manual QR Code')).toBeInTheDocument()
    })
  })

  describe('QR Code Scanning', () => {
    it('should call onScan when QR code is successfully scanned', async () => {
      const user = userEvent.setup()
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      await user.click(screen.getByTestId('start-scanner'))
      
      // Wait for the scan to complete
      await waitFor(() => {
        expect(mockOnScan).toHaveBeenCalledWith('TEST-QR-12345')
      }, { timeout: 2000 })
      
      // Should return to initial state after scanning
      expect(screen.getByTestId('start-scanner')).toBeInTheDocument()
    })

    it('should handle camera access errors', async () => {
      const user = userEvent.setup()
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      await user.click(screen.getByTestId('simulate-error'))
      
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error))
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Camera access denied'
        })
      )
    })
  })

  describe('Manual QR Input', () => {
    it('should allow manual QR code entry', async () => {
      const user = userEvent.setup()
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      const input = screen.getByTestId('manual-qr-input')
      const submitButton = screen.getByTestId('manual-submit')
      
      await user.type(input, 'MANUAL-QR-67890')
      await user.click(submitButton)
      
      expect(mockOnScan).toHaveBeenCalledWith('MANUAL-QR-67890')
    })

    it('should clear input after successful submission', async () => {
      const user = userEvent.setup()
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      const input = screen.getByTestId('manual-qr-input')
      const submitButton = screen.getByTestId('manual-submit')
      
      await user.type(input, 'TEST-QR')
      await user.click(submitButton)
      
      expect(input).toHaveValue('')
    })

    it('should ignore empty manual input', async () => {
      const user = userEvent.setup()
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      const submitButton = screen.getByTestId('manual-submit')
      
      await user.click(submitButton)
      
      expect(mockOnScan).not.toHaveBeenCalled()
    })

    it('should trim whitespace from manual input', async () => {
      const user = userEvent.setup()
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      const input = screen.getByTestId('manual-qr-input')
      const submitButton = screen.getByTestId('manual-submit')
      
      await user.type(input, '  TRIMMED-QR-123  ')
      await user.click(submitButton)
      
      expect(mockOnScan).toHaveBeenCalledWith('TRIMMED-QR-123')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support Enter key for manual submission', async () => {
      const user = userEvent.setup()
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      const input = screen.getByTestId('manual-qr-input')
      
      await user.type(input, 'KEYBOARD-QR-456{enter}')
      
      expect(mockOnScan).toHaveBeenCalledWith('KEYBOARD-QR-456')
    })

    it('should be focusable with Tab navigation', () => {
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      const startButton = screen.getByTestId('start-scanner')
      const input = screen.getByTestId('manual-qr-input')
      const submitButton = screen.getByTestId('manual-submit')
      
      // All interactive elements should be focusable
      expect(startButton).not.toHaveAttribute('tabindex', '-1')
      expect(input).not.toHaveAttribute('tabindex', '-1')
      expect(submitButton).not.toHaveAttribute('tabindex', '-1')
    })
  })

  describe('Error Handling', () => {
    it('should handle multiple error scenarios', async () => {
      const user = userEvent.setup()
      render(<MockQRScanner onScan={mockOnScan} onError={mockOnError} />)
      
      // Simulate camera error
      await user.click(screen.getByTestId('simulate-error'))
      
      expect(mockOnError).toHaveBeenCalledTimes(1)
      
      // Should still allow manual input after error
      const input = screen.getByTestId('manual-qr-input')
      await user.type(input, 'FALLBACK-QR')
      await user.click(screen.getByTestId('manual-submit'))
      
      expect(mockOnScan).toHaveBeenCalledWith('FALLBACK-QR')
    })
  })
})