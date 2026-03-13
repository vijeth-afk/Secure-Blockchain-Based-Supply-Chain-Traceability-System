import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import Web3 from "web3";
import { canEdit } from './permissions';
import SupplyChainABI from "./artifacts/SupplyChain.json";
import "./AddMed.css";

function AddMed() {
  const history = useHistory();
  useEffect(() => {
    loadWeb3();
    loadBlockchaindata();
  }, []);

  const [currentaccount, setCurrentaccount] = useState("");
  const [loader, setloader] = useState(true);
  const [SupplyChain, setSupplyChain] = useState();
  const [MED, setMED] = useState();
  const [MedName, setMedName] = useState();
  const [MedDes, setMedDes] = useState();
  const [MedQty, setMedQty] = useState(1);
  const [MedQtys, setMedQtys] = useState({});
  const [MedStage, setMedStage] = useState();

  const loadWeb3 = async () => {
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      await window.ethereum.enable();
    } else if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
    } else {
      window.alert(
        "Non-Ethereum browser detected. You should consider trying MetaMask!"
      );
    }
  };

  const loadBlockchaindata = async () => {
    setloader(true);
    const web3 = window.web3;
    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];
    setCurrentaccount(account);
    const networkId = await web3.eth.net.getId();
    const networkData = SupplyChainABI.networks[networkId];
    if (networkData) {
      const supplychain = new web3.eth.Contract(
        SupplyChainABI.abi,
        networkData.address
      );
      setSupplyChain(supplychain);
      var i;
      const medCtr = await supplychain.methods.medicineCtr().call();
      const med = {};
      const medStage = [];
      const medQtys = {};
      for (i = 0; i < medCtr; i++) {
        med[i] = await supplychain.methods.MedicineStock(i + 1).call();
        medStage[i] = await supplychain.methods.showStage(i + 1).call();
        // default quantity for items coming from chain (contract doesn't store quantity)
        medQtys[i] = 1;
      }
      setMED(med);
      setMedStage(medStage);
      setMedQtys(medQtys);
      setloader(false);
    } else {
      window.alert("The smart contract is not deployed to current network");
    }
  };
  if (loader) {
    return (
      <div className="addmed-page">
        <div className="addmed-grid" aria-hidden="true" />
        <div className="addmed-glow" aria-hidden="true" />
        <div className="addmed-content">
          <div className="loading-state">Initializing order console...</div>
        </div>
      </div>
    );
  }
  const role = localStorage.getItem('userRole');
  const editable = canEdit('addmed', role);
  const redirect_to_home = () => {
    history.push("/home");
  };
  const handlerChangeNameMED = (event) => {
    setMedName(event.target.value);
  };
  const handlerChangeDesMED = (event) => {
    setMedDes(event.target.value);
  };
  const handlerChangeQtyMED = (event) => {
    // ensure quantity is a number and at least 1
    const val = parseInt(event.target.value, 10);
    setMedQty(isNaN(val) || val < 1 ? 1 : val);
  };
  const handlerSubmitMED = async (event) => {
    event.preventDefault();
    try {
      var reciept = await SupplyChain.methods
        .addMedicine(MedName, MedDes)
        .send({ from: currentaccount });
      if (reciept) {
        // reload data and attach the submitted quantity to the newest item in the UI
        await loadBlockchaindata();
        try {
          // get latest medCtr and set qty for the newest item in local state
          const latestCtr = await SupplyChain.methods.medicineCtr().call();
          const index = latestCtr - 1; // our MED indices are zero-based
          setMedQtys((prev) => ({ ...prev, [index]: MedQty }));
        } catch (e) {
          // if anything goes wrong here, ignore — quantity is purely a frontend value
        }
      }
    } catch (err) {
      alert("An error occured!!!");
    }
  };
  return (
    <div className="addmed-page">
      <div className="addmed-grid" aria-hidden="true" />
      <div className="addmed-glow" aria-hidden="true" />
      <div className="addmed-content">
        <div className="addmed-header">
          <div>
            <p className="eyebrow">Order Console · Command Deck</p>
            <h2>Goods Intake</h2>
            <p className="subcopy">
              Capture new goods requests, sync on-chain state, and monitor every order’s lifecycle from a single futuristic hub.
            </p>
            <p className="subcopy subtle">
              <b>Account:</b> {currentaccount || 'Not connected'}
            </p>
          </div>
          <button onClick={redirect_to_home} className="addmed-btn danger">
            Back to Home
          </button>
        </div>

        <section className="addmed-card">
          <div className="card-title-row">
            <h5>Add Goods Order</h5>
            <span className="badge beta">On-chain</span>
          </div>
          {editable ? (
            <form onSubmit={handlerSubmitMED} className="addmed-form">
              <input
                className="form-control addmed-input"
                type="text"
                onChange={handlerChangeNameMED}
                placeholder="Goods Name"
                required
              />
              <input
                className="form-control addmed-input"
                type="text"
                onChange={handlerChangeDesMED}
                placeholder="Goods Description"
                required
              />
              <input
                className="form-control addmed-input"
                type="number"
                min="1"
                value={MedQty}
                onChange={handlerChangeQtyMED}
                placeholder="Quantity"
                required
              />
              <button className="addmed-btn primary" type="submit">
                Order
              </button>
            </form>
          ) : (
            <div className="addmed-alert">
              You have read-only access to orders. Use the tracking & supply pages to interact.
            </div>
          )}
        </section>

        <section className="addmed-card table-card">
          <div className="card-title-row">
            <h5>Ordered Goods</h5>
            <span className="badge beta">Live Ledger</span>
          </div>
          <div className="table-responsive">
            <table className="table addmed-table">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Name</th>
                  <th scope="col">Description</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Current Stage</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(MED).map(function (key) {
                  return (
                    <tr key={key}>
                      <td>{MED[key].id}</td>
                      <td>{MED[key].name}</td>
                      <td>{MED[key].description}</td>
                      <td>{MedQtys && MedQtys[key] ? MedQtys[key] : "-"}</td>
                      <td>
                        <span className="status-pill neutral">{MedStage[key]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AddMed;
