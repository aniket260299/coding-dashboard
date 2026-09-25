import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button, Navbar, NavbarBrand } from 'reactstrap';
import { useData } from '../data/DataContext';
import { pickFile, supportsFilePicker } from '../data/fileIO';

const Header = () => {
    const { loaded, fileName, dirty, status, error, save, loadFromFile, dismissMessages } = useData();
    const inputFile = useRef(null);

    const pickDataFile = async () => {
        if (supportsFilePicker()) {
            try {
                const { file, handle } = await pickFile();
                await loadFromFile(file, handle);
                return;
            } catch (pickError) {
                if (pickError.name === 'AbortError') return;
                console.warn('file picker failed, falling back to input element:', pickError);
            }
        }
        inputFile.current?.click();
    };

    const handleFileInput = async (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (file) await loadFromFile(file, null);
    };

    return (
        <div style={{ padding: '5px 15px' }}>
            <Navbar color="light" expand="md">
                <NavbarBrand tag={Link} to="/">Coding Dashboard</NavbarBrand>
                <div className="ms-auto d-flex align-items-center gap-3">
                    {loaded && <span className="text-muted small">
                        {fileName}{dirty ? ' • unsaved changes' : ''}
                    </span>}
                    {loaded && <Button size="sm" color="primary" onClick={save}>Save</Button>}
                    <Button size="sm" color="secondary" outline onClick={pickDataFile}>Load file</Button>
                </div>
            </Navbar>
            {(status || error) &&
                <div className={`alert py-1 px-3 mb-0 d-flex align-items-center gap-2 small ${error ? 'alert-warning' : 'alert-info'}`} role="alert">
                    <span>{error || status}</span>
                    <button type="button" className="btn-close float-end" aria-label="Close" onClick={dismissMessages}></button>
                </div>}
            <input style={{ display: 'none' }} ref={inputFile} onChange={handleFileInput} type="file" accept=".txt,.json,application/json,text/plain" />
        </div>
    );
};

export default Header;
