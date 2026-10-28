"use client"

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

type ConfirmButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  onConfirm: () => void
  /** Texto mostrado depois do primeiro clique. */
  confirmLabel?: ReactNode
}

/** Botão de duas etapas para ações destrutivas: o 1º clique pede confirmação, o 2º executa (em 4 s). */
export function ConfirmButton({ onConfirm, confirmLabel = "Confirmar?", variant, children, ...props }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function handleClick() {
    if (timer.current) clearTimeout(timer.current)
    if (armed) {
      setArmed(false)
      onConfirm()
      return
    }
    setArmed(true)
    timer.current = setTimeout(() => setArmed(false), 4000)
  }

  return (
    <Button {...props} variant={armed ? "destructive" : variant} onClick={handleClick}>
      {armed ? confirmLabel : children}
    </Button>
  )
}
