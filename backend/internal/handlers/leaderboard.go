package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"game2048/internal/cache"
	"game2048/internal/database"
	"game2048/pkg/models"

	"github.com/gin-gonic/gin"
)

// LeaderboardHandler handles leaderboard-related requests
type LeaderboardHandler struct {
	db    database.Database
	cache cache.Cache
}

// NewLeaderboardHandler creates a new leaderboard handler
func NewLeaderboardHandler(db database.Database, redisCache cache.Cache) *LeaderboardHandler {
	return &LeaderboardHandler{
		db:    db,
		cache: redisCache,
	}
}

// GetLeaderboard handles public leaderboard requests
func (h *LeaderboardHandler) GetLeaderboard(c *gin.Context) {
	// Get leaderboard type from query parameter
	leaderboardType := c.DefaultQuery("type", "daily")

	// Validate leaderboard type
	var lbType models.LeaderboardType
	switch leaderboardType {
	case "daily":
		lbType = models.LeaderboardDaily
	case "weekly":
		lbType = models.LeaderboardWeekly
	case "monthly":
		lbType = models.LeaderboardMonthly
	case "all":
		lbType = models.LeaderboardAll
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid leaderboard type. Must be one of: daily, weekly, monthly, all",
		})
		return
	}

	// Get limit from query parameter (default 100, max 100)
	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 100 {
		limit = 100
	}

	// Try to get from cache first
	var entries []models.LeaderboardEntry

	if h.cache != nil {
		entries, err = h.cache.GetLeaderboard(lbType)
		if err == nil {
			// Cache hit, return cached data
			response := models.LeaderboardResponse{
				Type:     lbType,
				Rankings: entries,
			}
			c.JSON(http.StatusOK, response)
			return
		}
	}

	// Cache miss or no cache, get from database
	entries, err = h.db.GetLeaderboard(lbType, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get leaderboard",
		})
		return
	}

	// Cache the result if cache is available
	if h.cache != nil {
		cacheTTL := 30 * time.Second // 30 seconds cache
		if err := h.cache.SetLeaderboard(lbType, entries, cacheTTL); err != nil {
			// Log error but don't fail the request
			// log.Printf("Failed to cache leaderboard: %v", err)
		}
	}

	// Return response
	response := models.LeaderboardResponse{
		Type:     lbType,
		Rankings: entries,
	}

	c.JSON(http.StatusOK, response)
}

// RefreshCache manually refreshes the leaderboard cache
// Only accessible by user with ID "1" (admin)
func (h *LeaderboardHandler) RefreshCache(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authentication required",
		})
		return
	}

	// Check if user is admin (ID = "1")
	if userID.(string) != "1" {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Access denied. Admin privileges required.",
		})
		return
	}

	// Check if cache is available
	if h.cache == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Cache service not available",
		})
		return
	}

	// Get the type parameter (optional)
	typeParam := c.Query("type")

	var refreshedTypes []string
	var errors []string

	if typeParam != "" {
		// Refresh specific leaderboard type
		lbType := models.LeaderboardType(typeParam)

		// Validate leaderboard type
		if lbType != models.LeaderboardDaily && lbType != models.LeaderboardWeekly && lbType != models.LeaderboardMonthly && lbType != models.LeaderboardAll {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid leaderboard type. Must be 'daily', 'weekly', 'monthly', or 'all'",
			})
			return
		}

		// Invalidate cache for this type
		if err := h.cache.InvalidateLeaderboard(lbType); err != nil {
			errors = append(errors, fmt.Sprintf("Failed to invalidate %s cache: %v", lbType, err))
		} else {
			refreshedTypes = append(refreshedTypes, string(lbType))
		}
	} else {
		// Refresh all leaderboard types
		allTypes := []models.LeaderboardType{
			models.LeaderboardDaily,
			models.LeaderboardWeekly,
			models.LeaderboardMonthly,
			models.LeaderboardAll,
		}

		for _, lbType := range allTypes {
			if err := h.cache.InvalidateLeaderboard(lbType); err != nil {
				errors = append(errors, fmt.Sprintf("Failed to invalidate %s cache: %v", lbType, err))
			} else {
				refreshedTypes = append(refreshedTypes, string(lbType))
			}
		}
	}

	// Prepare response
	response := gin.H{
		"message":         "Cache refresh completed",
		"refreshed_types": refreshedTypes,
	}

	if len(errors) > 0 {
		response["errors"] = errors
		response["message"] = "Cache refresh completed with some errors"
	}

	// Return appropriate status code
	if len(refreshedTypes) > 0 {
		c.JSON(http.StatusOK, response)
	} else {
		c.JSON(http.StatusInternalServerError, response)
	}
}
