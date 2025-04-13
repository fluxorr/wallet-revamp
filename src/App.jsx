import './App.css'
import WalletGenerator from './components/WalletGenerator';
import { ToastContainer } from 'react-toastify';

function App() {
  return (
    <div className='text-white' >
      < ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={true}
        newestOnTop={false}
        closeOnClick={true}
        rtl={false}
        pauseOnFocusLoss
        theme="dark"
      />
      <WalletGenerator />
    </div>
  )
}

export default App




