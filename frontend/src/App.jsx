import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Alunos from './pages/Alunos';
import AlunoPerfil from './pages/AlunoPerfil';
import Matriculas from './pages/Matriculas';
import Mensalidades from './pages/Mensalidades';
import NovoBoleto from './pages/NovoBoleto';
import Caixa from './pages/Caixa';
import Relatorios from './pages/Relatorios';
import Funcionarios from './pages/Funcionarios';
import Planos from './pages/Planos';
import Agendamentos from './pages/Agendamentos';
import ControleAcesso from './pages/ControleAcesso';

function ComLayout({ children, ...permissao }) {
  return (
    <ProtectedRoute {...permissao}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<ComLayout><Dashboard /></ComLayout>} />

      <Route path="/alunos" element={<ComLayout modulo="alunos"><Alunos /></ComLayout>} />
      <Route path="/alunos/:id" element={<ComLayout modulo="alunos"><AlunoPerfil /></ComLayout>} />

      <Route path="/matriculas" element={<ComLayout modulo="matriculas"><Matriculas /></ComLayout>} />

      <Route path="/mensalidades" element={<ComLayout modulo="mensalidades"><Mensalidades /></ComLayout>} />
      <Route
        path="/mensalidades/novo-carne"
        element={
          <ComLayout modulo="mensalidades" nivel="gerenciar">
            <NovoBoleto />
          </ComLayout>
        }
      />

      <Route path="/caixa" element={<ComLayout modulo="caixa"><Caixa /></ComLayout>} />
      <Route path="/relatorios" element={<ComLayout modulo="relatorios"><Relatorios /></ComLayout>} />
      <Route path="/agendamentos" element={<ComLayout modulo="agendamentos"><Agendamentos /></ComLayout>} />
      <Route path="/acesso" element={<ComLayout modulo="acesso"><ControleAcesso /></ComLayout>} />

      <Route path="/funcionarios" element={<ComLayout soAdmin><Funcionarios /></ComLayout>} />
      <Route path="/planos" element={<ComLayout soAdmin><Planos /></ComLayout>} />
    </Routes>
  );
}
