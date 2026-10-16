import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { FleetGlobalReport } from '@/lib/fleet-global-report-types'

const navy = '#122C42'
const teal = '#087F83'
const styles = StyleSheet.create({
  page: { paddingTop: 82, paddingBottom: 42, paddingHorizontal: 30, fontFamily: 'Helvetica', fontSize: 9, color: navy },
  header: { position: 'absolute', top: 22, left: 30, right: 30, borderBottomWidth: 2, borderBottomColor: teal, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 9, color: teal, marginTop: 4 },
  cards: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  card: { flex: 1, padding: 10, backgroundColor: '#EDF6F5', borderRadius: 5 },
  value: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: teal, marginBottom: 4 },
  section: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 9, marginBottom: 5 },
  row: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 7, borderBottomWidth: 0.5, borderBottomColor: '#DCE5EB' },
  cell: { flex: 1, paddingRight: 7 },
  label: { flex: 2, paddingRight: 10 },
  tableHead: { backgroundColor: navy, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  note: { fontSize: 8, lineHeight: 1.4, color: '#526575', marginTop: 10 },
  footer: { position: 'absolute', bottom: 18, left: 30, right: 30, fontSize: 8, color: '#526575', flexDirection: 'row', justifyContent: 'space-between' },
})
const euro = (amount: string) => `${Number(amount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

function Table({ title, headers, rows, empty }: { title: string; headers: string[]; rows: string[][]; empty: string }) {
  // Each section's header is fixed inside its wrapping container so continuation pages retain column context.
  return <View>
    <View fixed><Text style={styles.section}>{title}</Text><View style={[styles.row, styles.tableHead]}>{headers.map((heading, i) => <Text key={heading} style={i === 0 ? styles.label : styles.cell}>{heading}</Text>)}</View></View>
    {rows.length === 0 ? <Text style={styles.row}>{empty}</Text> : rows.map((row, index) => <View key={index} wrap={false} style={[styles.row, { backgroundColor: index % 2 ? '#F2F6F8' : '#FFFFFF' }]}>{row.map((cell, i) => <Text key={i} style={i === 0 ? styles.label : styles.cell}>{cell}</Text>)}</View>)}
  </View>
}

export function FleetGlobalDocument({ report }: { report: FleetGlobalReport }) {
  const { totals } = report
  const header = <View fixed style={styles.header}><View><Text style={styles.title}>Resumen global de flota</Text><Text style={styles.subtitle}>{report.periodLabel} · {report.trucks.length} camiones seleccionados</Text></View><Text style={styles.subtitle}>ACTIVIDAD REGISTRADA · SIN SALARIOS</Text></View>
  const footer = <View fixed style={styles.footer}><Text>Gestor EDI · Resumen consolidado · {report.periodLabel}</Text><Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} /></View>
  return <Document title={`Resumen global de flota · ${report.periodLabel}`} author="Gestor EDI">
    <Page size="A4" orientation="landscape" style={styles.page} wrap>
      {header}
      <Text>Selección: {report.trucks.map(truck => truck.plate).join(' · ') || 'Sin camiones seleccionados'}</Text>
      <View style={styles.cards} wrap={false}>{[
        [String(totals.truckDays), 'Días-camión operativos'], [String(totals.calendarDays), 'Fechas con actividad'], [String(totals.workerDays), 'Días únicos de trabajadores'], [totals.equivalentDays, 'Días equivalentes'], [euro(totals.fuelExpense), 'Combustible registrado'],
      ].map(([value, label]) => <View key={label} style={styles.card}><Text style={styles.value}>{value}</Text><Text>{label}</Text></View>)}</View>
      {totals.truckDays === 0 && <Text style={styles.note}>Sin actividad registrada en la selección y período. Esto no acredita inactividad real.</Text>}
      <Table title="01 / Camiones" headers={['Matrícula', 'Días operativos', 'Días equivalentes', 'Kilómetros', 'Combustible (€)']} rows={report.trucks.map(truck => [truck.plate, String(truck.operationalDays), truck.equivalentDays, Number(truck.kilometers).toLocaleString('es-ES', { maximumFractionDigits: 2 }), euro(truck.fuelExpense)])} empty="Sin camiones seleccionados." />
      <Table title="02 / Trabajadores" headers={['Trabajador', 'Días únicos', 'Días equivalentes']} rows={report.workers.map(worker => [worker.name, String(worker.days), worker.equivalentDays])} empty="Sin actividad de trabajadores registrada." />
      <Table title="03 / Empresas · agrupación de jornadas" headers={['Empresa', 'Días-camión', 'Días-trabajador', 'Días equivalentes']} rows={report.companies.map(company => [company.name, String(company.truckDays), String(company.workerDays), company.equivalentDays])} empty="Sin jornadas registradas por empresa." />
      {footer}
    </Page>
    <Page size="A4" orientation="landscape" style={styles.page} wrap>
      {header}
      <Table title="04 / Jornadas por camión con más de 200 km" headers={['Fecha', 'Matrícula', 'Empresa', 'Km recorridos']} rows={report.mileageDays.map(day => [
        day.date.split('-').reverse().join('/'), day.plate, day.companyName ?? 'Sin empresa asociada',
        day.kilometers.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
      ])} empty="Sin jornadas con más de 200 km en la selección y período." />
      <Table title="Totales por empresa · más de 200 km" headers={['Empresa', 'Días-camión']} rows={report.mileageCompanies.map(company => [company.companyName ?? 'Sin empresa asociada', String(company.truckDays)])} empty="Sin días-camión que totalizar." />
      <View wrap={false} style={styles.note}>
        <Text>Total: {report.mileageDays.length} días-camión con más de 200 km. Exactamente 200 km no se incluye.</Text>
        <Text>Un día-camión es una matrícula en una fecha. Dos camiones en la misma fecha cuentan como dos días-camión.</Text>
        <Text>La empresa corresponde a la jornada vinculada al kilometraje. Los registros sin vínculo se muestran como «Sin empresa asociada» y tienen su propio subtotal.</Text>
      </View>
      <View wrap={false} style={styles.note}>
        <Text>Día operativo: camión y fecha únicos. Fechas con actividad: fechas distintas de toda la selección. Día de trabajador: persona y fecha únicas, sin duplicar entre camiones.</Text>
        <Text>Días equivalentes: suma de porcentajes de jornada / 100. Los días únicos por empresa pueden solaparse; no deben sumarse para obtener personas-fecha globales.</Text>
        <Text>Combustible: dinero gastado registrado de los camiones y período seleccionados, no litros ni gasto atribuible a empresas. 0 € registrado no demuestra ausencia de consumo. Sin salarios.</Text>
      </View>
      {footer}
    </Page>
  </Document>
}
