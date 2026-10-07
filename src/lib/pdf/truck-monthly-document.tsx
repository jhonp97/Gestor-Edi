import { Fragment } from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ExportAssignment, TruckMonthlyExport } from '@/lib/truck-monthly-export'

const styles = StyleSheet.create({
  page: { paddingTop: 82, paddingBottom: 42, paddingHorizontal: 28, fontFamily: 'Helvetica', fontSize: 9 },
  header: { position: 'absolute', top: 24, left: 28, right: 28 },
  title: { fontSize: 16, marginBottom: 5 },
  labels: { flexDirection: 'row', backgroundColor: '#e8eef4', paddingVertical: 6, marginTop: 8 },
  row: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#dddddd' },
  date: { width: '13%', paddingHorizontal: 4 },
  worker: { width: '27%', paddingHorizontal: 4 },
  company: { width: '27%', paddingHorizontal: 4 },
  number: { width: '11%', paddingHorizontal: 4 },
  summaryPage: { paddingTop: 68, paddingBottom: 42, paddingHorizontal: 28, fontFamily: 'Helvetica', fontSize: 11 },
  workerPage: { paddingTop: 104, paddingBottom: 42, paddingHorizontal: 28, fontFamily: 'Helvetica', fontSize: 11 },
  workerPageHeader: { position: 'absolute', top: 24, left: 28, right: 28 },
  cards: { flexDirection: 'row', gap: 12 },
  card: { flexGrow: 1, flexBasis: 0, padding: 14, backgroundColor: '#eef2f6', borderWidth: 1, borderColor: '#c5cdd6' },
  figure: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginTop: 10 },
  balance: { padding: 14, marginTop: 12, backgroundColor: '#182d43', color: '#ffffff' },
  balanceLabel: { fontSize: 16, marginBottom: 6 },
  workerLabels: { flexDirection: 'row', paddingVertical: 10, backgroundColor: '#182d43', color: '#ffffff', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  workerRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#c5cdd6', fontSize: 11 },
  workerName: { width: '58%', paddingHorizontal: 6 },
  workerDays: { width: '17%', paddingHorizontal: 6 },
  footer: { position: 'absolute', bottom: 18, left: 28, right: 28, textAlign: 'center', fontSize: 8 },
})
const missing = 'Sin registro'
const money = (value: string | null) => value === null ? missing : `${value} EUR`
const balanceStatus = (value: string | null) => {
  if (value === null) return missing
  if (!/[1-9]/.test(value)) return 'Sin diferencia'
  return value.startsWith('-') ? 'Saldo negativo' : 'Saldo positivo'
}

function AssignmentCells({ worker }: { worker?: ExportAssignment }) {
  return <>
    <Text style={styles.worker}>{worker ? `${worker.name} (${worker.share}%)` : missing}</Text>
    <Text style={styles.company}>{worker?.company ?? missing}</Text>
  </>
}

export function TruckMonthlyDocument({ report }: { report: TruckMonthlyExport }) {
  return <Document title={`Informe mensual de camiones ${report.month}`}>
    {report.trucks.length === 0 && <Page size="A4" orientation="landscape" style={styles.page}>
      <Text>Informe mensual {report.month}: no hay camiones registrados.</Text>
    </Page>}
    {report.trucks.map(truck => <Fragment key={truck.id}>
    <Page size="A4" orientation="landscape" style={styles.page} wrap>
      <View fixed style={styles.header}>
        <Text style={styles.title}>Informe mensual · {report.month} · Camión {truck.plate}</Text>
        <View style={styles.labels}>
          <Text style={styles.date}>Fecha</Text><Text style={styles.worker}>Trabajador / %</Text><Text style={styles.company}>Empresa de jornada</Text>
          <Text style={styles.number}>Km</Text><Text style={styles.number}>Gastos</Text><Text style={styles.number}>Ingresos</Text>
        </View>
      </View>
      {truck.days.length === 0 && <Text>Sin actividad registrada este mes.</Text>}
      {truck.days.map(day => <View key={day.date}>
        <View style={styles.row}>
          <Text style={styles.date}>{day.date}</Text><AssignmentCells worker={day.workers[0]} />
          <Text style={styles.number}>{day.km ?? missing}</Text><Text style={styles.number}>{money(day.expense)}</Text><Text style={styles.number}>{money(day.income)}</Text>
        </View>
        {day.workers.slice(1).map((worker, index) => <View key={`${worker.id}-${index}`} style={styles.row}>
          <Text style={styles.date}>{day.date}</Text><AssignmentCells worker={worker} />
          <Text style={styles.number}>—</Text><Text style={styles.number}>—</Text><Text style={styles.number}>—</Text>
        </View>)}
      </View>)}
      <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </Page>
    <Page size="A4" orientation="landscape" style={styles.summaryPage} wrap>
      <View fixed style={styles.header}>
        <Text style={styles.title}>Resumen del mes · {report.month} · Camión {truck.plate}</Text>
      </View>
      <View wrap={false}>
        <View style={styles.cards}>
          <View style={styles.card}><Text>Kilómetros recorridos</Text><Text style={styles.figure}>{truck.totals.km ?? missing}</Text></View>
          <View style={styles.card}><Text>Gastos del mes</Text><Text style={styles.figure}>{money(truck.totals.expense)}</Text></View>
          <View style={styles.card}><Text>Ingresos del mes</Text><Text style={styles.figure}>{money(truck.totals.income)}</Text></View>
        </View>
        <View style={styles.balance}>
          <Text style={styles.balanceLabel}>Balance del mes</Text>
          <Text>Ingresos menos gastos</Text>
          <Text style={styles.figure}>{money(truck.totals.net)}</Text>
          <Text>{balanceStatus(truck.totals.net)}</Text>
        </View>
      </View>
      <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </Page>
    <Page size="A4" orientation="landscape" style={styles.workerPage} wrap>
      <View fixed style={styles.workerPageHeader}>
        <Text style={styles.title}>Días trabajados por trabajador · {report.month} · Camión {truck.plate}</Text>
        <View style={styles.workerLabels} wrap={false}>
          <Text style={styles.workerName}>Trabajador</Text><Text style={styles.workerDays}>Días trabajados</Text><Text style={styles.workerDays}>Días equivalentes</Text>
        </View>
      </View>
      {truck.workers.length === 0 && <Text>Sin jornadas registradas.</Text>}
      {truck.workers.map((worker, index) => <View key={worker.id} wrap={false} style={[styles.workerRow, { backgroundColor: index % 2 === 0 ? '#eef2f6' : '#ffffff' }]}>
        <Text style={styles.workerName}>{worker.name}</Text><Text style={styles.workerDays}>{worker.dates}</Text><Text style={styles.workerDays}>{worker.equivalentDays}</Text>
      </View>)}
      <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </Page>
    </Fragment>)}
  </Document>
}
