import React from 'react';
import { MenuItem } from '../models/menu';

interface MenuProps {
  title: string;
  message: string;
  menuItems: MenuItem[];
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  title: {
    fontSize: '3rem',
    fontWeight: 700,
    color: '#2d3748',
    textAlign: 'center' as const,
    marginBottom: '1rem',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    fontSize: '1.5rem',
    color: '#4a5568',
    textAlign: 'center' as const,
    marginBottom: '0.5rem'
  },
  message: {
    fontSize: '1.1rem',
    color: '#718096',
    textAlign: 'center' as const,
    marginBottom: '3rem'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '2rem',
    padding: '1rem'
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    padding: '1.5rem',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    position: 'relative' as const,
    overflow: 'hidden',
    ':hover': {
      transform: 'translateY(-5px)',
      boxShadow: '0 8px 12px rgba(0, 0, 0, 0.15)'
    }
  },
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#1a202c',
    marginBottom: '1rem',
    position: 'relative' as const,
    paddingBottom: '0.5rem',
    borderBottom: '3px solid #4299e1',
    width: 'fit-content'
  },
  cardDescription: {
    fontSize: '1rem',
    lineHeight: 1.6,
    color: '#4a5568',
    marginBottom: '1.5rem'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: '1rem',
    borderTop: '1px solid #e2e8f0'
  },
  itemType: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#48bb78',
    padding: '0.25rem 0.75rem',
    background: '#f0fff4',
    borderRadius: '20px'
  }
};

export const Menu = ({ title, message, menuItems }: MenuProps) => {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Menu</h1>
      <p style={styles.subtitle}>{title}</p>
      <p style={styles.message}>{message}</p>
      <div style={styles.grid}>
        {menuItems.map((item) => (
          <div key={item.name} style={styles.card}>
            <h3 style={styles.cardTitle}>{item.name}</h3>
            <p style={styles.cardDescription}>{item.description}</p>
            <div style={styles.cardFooter}>
              <span style={styles.itemType}>{item.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};