import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  // Comment out the condition that hides pagination for single pages
  // if (totalPages <= 1) return null;
  
  // Create an array of page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5; // Show max 5 page numbers at a time
    
    // Always ensure we have at least one page
    const effectiveTotalPages = Math.max(1, totalPages);
    
    if (effectiveTotalPages <= maxPagesToShow) {
      // If total pages is less than or equal to max, show all pages
      for (let i = 1; i <= effectiveTotalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always include first page
      pages.push(1);
      
      // Calculate start and end of middle pages
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(effectiveTotalPages - 1, currentPage + 1);
      
      // Adjust if we're near the beginning
      if (currentPage <= 3) {
        endPage = Math.min(effectiveTotalPages - 1, 4);
      }
      
      // Adjust if we're near the end
      if (currentPage >= effectiveTotalPages - 2) {
        startPage = Math.max(2, effectiveTotalPages - 3);
      }
      
      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (endPage < effectiveTotalPages - 1) {
        pages.push('...');
      }
      
      // Always include last page
      pages.push(effectiveTotalPages);
    }
    
    return pages;
  };
  
  // Ensure we have at least one page for display purposes
  const displayTotalPages = Math.max(1, totalPages);
  const displayCurrentPage = Math.min(Math.max(1, currentPage), displayTotalPages);
  
  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Page {displayCurrentPage} of {displayTotalPages}
      </div>

      <div className="pagination">
        {/* Previous button */}
        <button 
          className={`pagination-button pagination-nav ${displayCurrentPage === 1 ? 'disabled' : ''}`}
          onClick={() => displayCurrentPage > 1 && onPageChange(displayCurrentPage - 1)}
          disabled={displayCurrentPage === 1}
          aria-label="Previous page"
        >
          <span className="pagination-icon">&laquo;</span>
          <span className="pagination-text">Prev</span>
        </button>
        
        {/* Page numbers */}
        <div className="pagination-numbers">
          {getPageNumbers().map((page, index) => (
            page === '...' ? (
              <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
            ) : (
              <button
                key={`page-${page}`}
                className={`pagination-number ${displayCurrentPage === page ? 'active' : ''}`}
                onClick={() => typeof page === 'number' && onPageChange(page)}
                aria-label={`Go to page ${page}`}
                aria-current={displayCurrentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            )
          ))}
        </div>
        
        {/* Next button */}
        <button 
          className={`pagination-button pagination-nav ${displayCurrentPage === displayTotalPages ? 'disabled' : ''}`}
          onClick={() => displayCurrentPage < displayTotalPages && onPageChange(displayCurrentPage + 1)}
          disabled={displayCurrentPage === displayTotalPages}
          aria-label="Next page"
        >
          <span className="pagination-text">Next</span>
          <span className="pagination-icon">&raquo;</span>
        </button>
      </div>
    </div>
  );
};

export default Pagination;
