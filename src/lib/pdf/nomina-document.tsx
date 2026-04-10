import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// Professional styles
const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1e3a5f' },
  section: { marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { color: '#64748b' },
  value: { fontWeight: 'bold' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 10 },
  total: { fontSize: 14, fontWeight: 'bold', color: '#1e3a5f' },
  footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', color: '#94a3b8', fontSize: 8 },
})

interface NominaDocumentProps {
  payroll: {
    id: string
    month: number
    year: number
    baseSalary: number
    irpfPercent: number
    irpfAmount: number
    socialSecurityPercent: number
    socialSecurityAmount: number
    otherDeductions: number
    grossPay: number
    netPay: number
    paidAt: string | null
    worker: {
      name: string
      dni: string
      position: string
    }
  }
}

export function NominaDocument({ payroll }: NominaDocumentProps) {
  const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>RECIBO DE NÓMINA</Text>
            <Text style={{ color: '#64748b' }}>Flota Camiones EDI</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text>Período: {monthNames[payroll.month]} {payroll.year}</Text>
            <Text>Fecha: {new Date().toLocaleDateString('es-ES')}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Worker Info */}
        <View style={styles.section}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>DATOS DEL TRABAJADOR</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nombre:</Text>
            <Text style={styles.value}>{payroll.worker.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>DNI:</Text>
            <Text style={styles.value}>{payroll.worker.dni}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Puesto:</Text>
            <Text style={styles.value}>{payroll.worker.position}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Salary Breakdown */}
        <View style={styles.section}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>DEVENGOS</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Salario Base:</Text>
            <Text style={styles.value}>{payroll.baseSalary.toFixed(2)} €</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Devengos:</Text>
            <Text style={styles.value}>{payroll.grossPay.toFixed(2)} €</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Deductions */}
        <View style={styles.section}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>DEDUCCIONES</Text>
          <View style={styles.row}>
            <Text style={styles.label}>IRPF ({payroll.irpfPercent}%):</Text>
            <Text style={styles.value}>- {payroll.irpfAmount.toFixed(2)} €</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Seg. Social ({payroll.socialSecurityPercent}%):</Text>
            <Text style={styles.value}>- {payroll.socialSecurityAmount.toFixed(2)} €</Text>
          </View>
          {payroll.otherDeductions > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Otras deducciones:</Text>
              <Text style={styles.value}>- {payroll.otherDeductions.toFixed(2)} €</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Total Deducciones:</Text>
            <Text style={styles.value}>- {(payroll.irpfAmount + payroll.socialSecurityAmount + payroll.otherDeductions).toFixed(2)} €</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Net Pay */}
        <View style={[styles.section, { backgroundColor: '#f0f9ff', padding: 15, borderRadius: 5 }]}>
          <View style={styles.row}>
            <Text style={styles.total}>LÍQUIDO A PERCIBIR:</Text>
            <Text style={styles.total}>{payroll.netPay.toFixed(2)} €</Text>
          </View>
        </View>

        {/* Status */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: payroll.paidAt ? '#10b981' : '#f59e0b' }}>
            Estado: {payroll.paidAt ? `PAGADO (${new Date(payroll.paidAt).toLocaleDateString('es-ES')})` : 'PENDIENTE DE PAGO'}
          </Text>
        </View>

        {/* Signature Area */}
        <View style={{ marginTop: 40, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ width: '40%', borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 5 }}>
            <Text style={{ textAlign: 'center', fontSize: 8 }}>Firma del Trabajador</Text>
          </View>
          <View style={{ width: '40%', borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 5 }}>
            <Text style={{ textAlign: 'center', fontSize: 8 }}>Firma de la Empresa</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Este documento es un recibo de nómina generado automáticamente por Flota Camiones EDI.
        </Text>
      </Page>
    </Document>
  )
}
